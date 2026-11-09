import { NextResponse } from 'next/server';
import { listWorkers } from '@/lib/db';
import { isAdminRequest } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Sesi admin tidak aktif.' }, { status: 401 });
  return NextResponse.json({ users: listWorkers() }, { headers: { 'Cache-Control': 'no-store' } });
}
