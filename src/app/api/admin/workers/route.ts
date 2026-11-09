import { NextResponse } from 'next/server';
import { createWorker, listAdminWorkers, updateWorker } from '@/lib/db';
import { isAdminRequest } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const validId = (value: unknown): value is string => typeof value === 'string' && /^EMP-[A-Z0-9-]{1,20}$/.test(value);
const validText = (value: unknown, min = 2, max = 80): value is string => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const validPin = (value: unknown): value is string => typeof value === 'string' && /^\d{4,8}$/.test(value);
function unauthorized() { return NextResponse.json({ error: 'Sesi admin tidak aktif.' }, { status: 401 }); }
export function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  return NextResponse.json({ workers: listAdminWorkers() }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const body = await request.json() as { id?: unknown; name?: unknown; division?: unknown; pin?: unknown };
    const id = typeof body.id === 'string' ? body.id.trim().toUpperCase() : '';
    if (!validId(id) || !validText(body.name) || !validText(body.division) || !validPin(body.pin)) {
      return NextResponse.json({ error: 'Isi ID (EMP-...), nama, divisi, dan PIN 4–8 digit dengan benar.' }, { status: 400 });
    }
    const worker = createWorker({ id, name: body.name.trim(), division: body.division.trim(), pin: body.pin });
    return NextResponse.json({ worker }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) return NextResponse.json({ error: 'ID pekerja sudah digunakan.' }, { status: 409 });
    return NextResponse.json({ error: 'Akun pekerja gagal disimpan.' }, { status: 400 });
  }
}
export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const body = await request.json() as { id?: unknown; name?: unknown; division?: unknown; active?: unknown; pin?: unknown };
    if (!validId(body.id) || !validText(body.name) || !validText(body.division) || typeof body.active !== 'boolean' || (body.pin !== undefined && body.pin !== '' && !validPin(body.pin))) {
      return NextResponse.json({ error: 'Data pekerja tidak valid. PIN baru harus 4–8 digit.' }, { status: 400 });
    }
    const worker = updateWorker(body.id, {
      name: body.name.trim(), division: body.division.trim(), active: body.active,
      ...(typeof body.pin === 'string' && body.pin ? { pin: body.pin } : {}),
    });
    if (!worker) return NextResponse.json({ error: 'Pekerja tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ worker });
  } catch {
    return NextResponse.json({ error: 'Perubahan akun gagal disimpan.' }, { status: 400 });
  }
}
