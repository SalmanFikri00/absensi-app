import { NextResponse } from 'next/server';
import { createWorkerSession, getWorker, revokeWorkerSession, todayForWorker, verifyWorkerCredentials, workerForSession } from '@/lib/db';
import { getWorkerSessionToken, makeQrPayload, makeWorkerSession, workerCookieName } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function profile(workerId: string) {
  const worker = getWorker(workerId);
  if (!worker) return null;
  const attendance = todayForWorker(worker.id);
  return {
    worker,
    qr: makeQrPayload(worker.id),
    attendance: attendance ? { checkedIn: true, time: attendance.check_in_time } : { checkedIn: false },
  };
}
export function GET(request: Request) {
  const token = getWorkerSessionToken(request);
  const worker = token ? workerForSession(token) : null;
  if (!worker) return NextResponse.json({ error: 'Sesi pekerja berakhir. Silakan masuk kembali.' }, { status: 401 });
  const data = profile(worker.id);
  if (!data) return NextResponse.json({ error: 'Akun pekerja tidak aktif.' }, { status: 403 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: unknown; pin?: unknown };
    if (typeof body.id !== 'string' || typeof body.pin !== 'string' || !/^EMP-[A-Z0-9-]{1,20}$/i.test(body.id.trim()) || !/^\d{4,8}$/.test(body.pin)) {
      return NextResponse.json({ error: 'Masukkan ID pekerja dan PIN.' }, { status: 400 });
    }
    const id = body.id.trim().toUpperCase();
    const worker = verifyWorkerCredentials(id, body.pin);
    if (!worker) return NextResponse.json({ error: 'ID pekerja atau PIN tidak sesuai.' }, { status: 401 });
    const response = NextResponse.json({ ...profile(worker.id) }, { headers: { 'Cache-Control': 'no-store' } });
    const token = makeWorkerSession();
    createWorkerSession(worker.id, token);
    response.cookies.set(workerCookieName, token, {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
      path: '/', maxAge: 12 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 400 });
  }
}
export function DELETE(request: Request) {
  const token = getWorkerSessionToken(request);
  if (token) revokeWorkerSession(token);
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(workerCookieName, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
