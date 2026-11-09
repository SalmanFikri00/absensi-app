import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const qrSecret = process.env.QR_SECRET || 'dev-only-change-this-qr-secret-before-deploy';
const adminPin = process.env.ADMIN_PIN || '2468';
const sessionSecret = process.env.ADMIN_SESSION_SECRET || qrSecret;
const COOKIE_NAME = 'lapangan_admin';
const WORKER_COOKIE_NAME = 'poshadir_worker';
function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}
function safeEqualHex(expected: string, supplied: string) {
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(supplied, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function makeQrPayload(uid: string, t = Math.floor(Date.now() / 1000)) {
  const sig = sign(`${uid}.${t}`, qrSecret);
  return JSON.stringify({ uid, t, sig });
}
export function verifyQrPayload(payload: unknown): { uid: string } | null {
  if (typeof payload !== 'string' || payload.length > 500) return null;
  try {
    const parsed = JSON.parse(payload) as { uid?: unknown; t?: unknown; sig?: unknown };
    if (typeof parsed.uid !== 'string' || !/^EMP-[A-Z0-9-]{1,20}$/.test(parsed.uid)) return null;
    if (typeof parsed.t !== 'number' || typeof parsed.sig !== 'string') return null;
    const age = Math.floor(Date.now() / 1000) - parsed.t;
    if (age < -300 || age > 24 * 60 * 60) return null;
    if (!safeEqualHex(sign(`${parsed.uid}.${parsed.t}`, qrSecret), parsed.sig)) return null;
    return { uid: parsed.uid };
  } catch {
    return null;
  }
}
export function verifyAdminPin(candidate: unknown) {
  return typeof candidate === 'string' && candidate.length <= 64 && candidate === adminPin;
}
export function makeAdminSession() {
  const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  return `${expires}.${sign(`admin.${expires}`, sessionSecret)}`;
}
export function isAdminRequest(request: Request) {
  const raw = cookieValue(request, COOKIE_NAME);
  if (!raw) return false;
  const [expiresRaw, supplied] = raw.split('.');
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || !supplied) return false;
  return safeEqualHex(sign(`admin.${expires}`, sessionSecret), supplied);
}
export function makeWorkerSession() {
  return randomBytes(32).toString('hex');
}
export function getWorkerSessionToken(request: Request): string | null {
  const raw = cookieValue(request, WORKER_COOKIE_NAME);
  return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : null;
}
export const adminCookieName = COOKIE_NAME;
export const workerCookieName = WORKER_COOKIE_NAME;
