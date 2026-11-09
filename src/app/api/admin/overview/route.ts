import { NextResponse } from 'next/server';
import { adminOverview } from '@/lib/db';
import { isAdminRequest } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Sesi petugas tidak aktif.' }, { status: 401 });
  const base = adminOverview();
  const syncConfigured = Boolean(process.env.CLOUD_WEBHOOK_URL);
  let networkOnline = false;
  if (syncConfigured) {
    try {
      const result = await fetch('https://www.google.com', { method: 'HEAD', signal: AbortSignal.timeout(2500), cache: 'no-store' });
      networkOnline = result.ok;
    } catch { networkOnline = false; }
  }
  return NextResponse.json({ ...base, syncConfigured, networkOnline }, { headers: { 'Cache-Control': 'no-store' } });
}
