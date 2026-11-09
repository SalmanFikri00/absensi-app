import { NextResponse } from 'next/server';
import { checkIn, getWorkerWithPin, todayForWorker } from '@/lib/db';
import { isAdminRequest, verifyQrPayload } from '@/lib/security';
import { formatJakartaTime } from '@/lib/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ status: 'unauthorized', message: 'Masuk sebagai petugas untuk memindai QR.' }, { status: 401 });
  try {
    const body = await request.json() as { payload?: unknown };
    const valid = verifyQrPayload(body.payload);
    if (!valid) return NextResponse.json({ status: 'invalid', message: 'QR tidak valid atau sudah kedaluwarsa.' }, { status: 400 });
    const worker = getWorkerWithPin(valid.uid);
    if (!worker) return NextResponse.json({ status: 'invalid', message: 'Pekerja tidak terdaftar.' }, { status: 404 });
    const existing = todayForWorker(worker.id);
    if (existing) {
      return NextResponse.json({
        status: 'duplicate', message: `${worker.name} sudah absen pukul ${formatJakartaTime(existing.check_in_time)}.`,
        worker: { id: worker.id, name: worker.name }, time: existing.check_in_time,
      }, { status: 409 });
    }
    const timestamp = new Date().toISOString();
    checkIn(worker.id, timestamp);
    return NextResponse.json({
      status: 'success', message: `Check-in berhasil. Selamat bekerja, ${worker.name}.`,
      worker: { id: worker.id, name: worker.name, division: worker.division }, time: timestamp,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ status: 'duplicate', message: 'Pekerja sudah tercatat hadir hari ini.' }, { status: 409 });
    }
    return NextResponse.json({ status: 'error', message: 'Absensi gagal disimpan. Coba pindai lagi.' }, { status: 500 });
  }
}
