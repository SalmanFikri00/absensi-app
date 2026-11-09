import { markSynced, pendingSyncBatch } from '../src/lib/db';

const endpoint = process.env.CLOUD_WEBHOOK_URL;
const token = process.env.CLOUD_WEBHOOK_TOKEN;
const intervalMs = 15_000;
let running = false;
let warnedDisabled = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    if (!endpoint) {
      if (!warnedDisabled) { console.log('[sync] CLOUD_WEBHOOK_URL belum diatur; data tetap disimpan lokal.'); warnedDisabled = true; }
      return;
    }
    try {
      const probe = await fetch('https://www.google.com', { method: 'HEAD', signal: AbortSignal.timeout(2500) });
      if (!probe.ok) return;
    } catch { return; }

    const batch = pendingSyncBatch(50);
    if (!batch.length) return;
    const records = batch.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.name,
      division: row.division,
      check_in_time: row.check_in_time,
      check_in_date: row.check_in_date,
      idempotency_key: `${row.user_id}:${row.check_in_date}`,
    }));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ records }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) { console.warn(`[sync] Endpoint mengembalikan HTTP ${response.status}; akan dicoba ulang.`); return; }
    const data = await response.json() as { committed_ids?: unknown };
    if (!Array.isArray(data.committed_ids)) { console.warn('[sync] Respons belum berisi committed_ids; batch tidak ditandai tersinkron.'); return; }
    const batchIds = new Set(batch.map((row) => row.id));
    const acknowledged = data.committed_ids.filter((id): id is number => Number.isInteger(id) && batchIds.has(id));
    const updated = markSynced(acknowledged);
    if (updated) console.log(`[sync] ${updated} record dikonfirmasi oleh endpoint.`);
  } catch (error) {
    console.warn('[sync] Siklus gagal; akan dicoba ulang.', error instanceof Error ? error.message : 'unknown error');
  } finally {
    running = false;
  }
}

console.log(`[sync] Worker aktif; interval ${intervalMs / 1000} detik.`);
void tick();
setInterval(() => void tick(), intervalMs);
