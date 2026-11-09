import { Database } from 'bun:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { jakartaDate } from '@/lib/time';

export type Worker = { id: string; name: string; division: string };
export type AdminWorker = Worker & { active: number; created_at: string };
export type AttendanceRow = {
  id: number; user_id: string; name: string; division: string;
  check_in_time: string; check_in_date: string; synced: number;
};

const filename = process.env.DB_PATH || path.join(process.cwd(), 'data', 'attendance.db');
mkdirSync(path.dirname(filename), { recursive: true });
const db = new Database(filename, { create: true, strict: true });
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    division TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '',
    pin_hash TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS attendance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    check_in_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_in_date TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, check_in_date)
  );
  CREATE TABLE IF NOT EXISTS worker_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_worker_session_user ON worker_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_sync ON attendance_logs(synced);
  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(check_in_date);
`);

// Add columns to databases created by earlier PosHadir builds without dropping records.
const userColumns = new Set(db.query<{ name: string }>('PRAGMA table_info(users)').all().map((column) => column.name));
if (!userColumns.has('pin_hash')) db.exec("ALTER TABLE users ADD COLUMN pin_hash TEXT NOT NULL DEFAULT ''");
if (!userColumns.has('active')) db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');

function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 64).toString('hex')}`;
}
function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const demoWorkers: Worker[] = [
  { id: 'EMP-001', name: 'Ari Pratama', division: 'Operasional' },
  { id: 'EMP-002', name: 'Siti Rahmawati', division: 'Logistik' },
  { id: 'EMP-003', name: 'Budi Santoso', division: 'Konstruksi' },
  { id: 'EMP-004', name: 'Dewi Lestari', division: 'K3 & Lingkungan' },
  { id: 'EMP-005', name: 'Rizky Ramadhan', division: 'Operasional' },
  { id: 'EMP-006', name: 'Nadia Putri', division: 'Logistik' },
  { id: 'EMP-007', name: 'Fajar Nugroho', division: 'Konstruksi' },
  { id: 'EMP-008', name: 'Intan Permata', division: 'K3 & Lingkungan' },
  { id: 'EMP-009', name: 'Dimas Saputra', division: 'Operasional' },
  { id: 'EMP-010', name: 'Lina Kartika', division: 'Logistik' },
];
const insertWorker = db.query('INSERT OR IGNORE INTO users (id, name, division, pin) VALUES (?, ?, ?, ?)');
for (const worker of demoWorkers) insertWorker.run(worker.id, worker.name, worker.division, '1234');

// Hash legacy/demo PINs once, then remove their plaintext copies from the database.
const legacyCredentials = db.query<{ id: string; pin: string; pin_hash: string }>(
  "SELECT id, pin, pin_hash FROM users WHERE pin_hash = ''",
).all();
const saveCredential = db.query('UPDATE users SET pin = ?, pin_hash = ? WHERE id = ?');
for (const row of legacyCredentials) saveCredential.run('', hashPin(row.pin || '1234'), row.id);

export function listWorkers(): Worker[] {
  return db.query<Worker>('SELECT id, name, division FROM users WHERE active = 1 ORDER BY name').all();
}
export function listAdminWorkers(): AdminWorker[] {
  return db.query<AdminWorker>('SELECT id, name, division, active, created_at FROM users ORDER BY active DESC, name').all();
}
export function getWorker(id: string): Worker | null {
  return db.query<Worker>('SELECT id, name, division FROM users WHERE id = ? AND active = 1').get(id);
}
export function verifyWorkerCredentials(id: string, pin: string): Worker | undefined {
  const worker = db.query<Worker & { pin_hash: string; active: number }>(
    'SELECT id, name, division, pin_hash, active FROM users WHERE id = ?',
  ).get(id);
  if (!worker || worker.active !== 1 || !verifyPin(pin, worker.pin_hash)) return undefined;
  return { id: worker.id, name: worker.name, division: worker.division };
}
export function getWorkerWithPin(id: string) {
  return getWorker(id);
}
export function createWorker(worker: Worker & { pin: string }) {
  db.query("INSERT INTO users (id, name, division, pin, pin_hash, active) VALUES (?, ?, ?, '', ?, 1)")
    .run(worker.id, worker.name, worker.division, hashPin(worker.pin));
  return db.query<AdminWorker>('SELECT id, name, division, active, created_at FROM users WHERE id = ?').get(worker.id);
}
export function updateWorker(id: string, worker: { name: string; division: string; active: boolean; pin?: string }) {
  return db.transaction(() => {
    const previous = db.query<{ active: number }>('SELECT active FROM users WHERE id = ?').get(id);
    if (!previous) return null;
    if (worker.pin) {
      db.query('UPDATE users SET name = ?, division = ?, active = ?, pin_hash = ?, pin = ? WHERE id = ?')
        .run(worker.name, worker.division, worker.active ? 1 : 0, hashPin(worker.pin), '', id);
    } else {
      db.query('UPDATE users SET name = ?, division = ?, active = ? WHERE id = ?')
        .run(worker.name, worker.division, worker.active ? 1 : 0, id);
    }
    if (worker.pin || previous.active !== (worker.active ? 1 : 0)) {
      db.query('DELETE FROM worker_sessions WHERE user_id = ?').run(id);
    }
    return db.query<AdminWorker>('SELECT id, name, division, active, created_at FROM users WHERE id = ?').get(id);
  })();
}
function sessionHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function createWorkerSession(id: string, token: string) {
  const now = Math.floor(Date.now() / 1000);
  db.query('DELETE FROM worker_sessions WHERE expires_at < ?').run(now);
  db.query('INSERT INTO worker_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionHash(token), id, now + 12 * 60 * 60);
}
export function workerForSession(token: string): Worker | null {
  return db.query<Worker>(`
    SELECT u.id, u.name, u.division FROM users u JOIN worker_sessions s ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at >= ? AND u.active = 1
  `).get(sessionHash(token), Math.floor(Date.now() / 1000));
}
export function revokeWorkerSession(token: string) {
  db.query('DELETE FROM worker_sessions WHERE token_hash = ?').run(sessionHash(token));
}
export function todayForWorker(id: string) {
  return db.query<{ check_in_time: string; synced: number }>(
    'SELECT check_in_time, synced FROM attendance_logs WHERE user_id = ? AND check_in_date = ?',
  ).get(id, jakartaDate());
}
export function checkIn(id: string, timestamp = new Date().toISOString()) {
  const date = jakartaDate(new Date(timestamp));
  return db.query('INSERT INTO attendance_logs (user_id, check_in_time, check_in_date) VALUES (?, ?, ?)')
    .run(id, timestamp, date);
}
export function adminOverview() {
  const date = jakartaDate();
  const workers = db.query<{ total: number }>('SELECT COUNT(*) AS total FROM users WHERE active = 1').get()?.total ?? 0;
  const present = db.query<{ total: number }>('SELECT COUNT(*) AS total FROM attendance_logs WHERE check_in_date = ?').get(date)?.total ?? 0;
  const pending = db.query<{ total: number }>('SELECT COUNT(*) AS total FROM attendance_logs WHERE synced = 0').get()?.total ?? 0;
  const recent = db.query<AttendanceRow>(`
    SELECT a.id, a.user_id, u.name, u.division, a.check_in_time, a.check_in_date, a.synced
    FROM attendance_logs a JOIN users u ON u.id = a.user_id
    WHERE a.check_in_date = ? ORDER BY a.check_in_time DESC LIMIT 30
  `).all(date);
  return { workers, present, pending, recent, date };
}
export function pendingSyncBatch(limit = 50) {
  return db.query<AttendanceRow>(`
    SELECT a.id, a.user_id, u.name, u.division, a.check_in_time, a.check_in_date, a.synced
    FROM attendance_logs a JOIN users u ON u.id = a.user_id
    WHERE a.synced = 0 ORDER BY a.check_in_time ASC LIMIT ?
  `).all(limit);
}
export function markSynced(ids: number[]) {
  if (!ids.length) return 0;
  const transaction = db.transaction((items: number[]) => {
    const update = db.query('UPDATE attendance_logs SET synced = 1, synced_at = CURRENT_TIMESTAMP WHERE id = ? AND synced = 0');
    let changes = 0;
    for (const id of items) changes += update.run(id).changes;
    return changes;
  });
  return transaction(ids);
}
