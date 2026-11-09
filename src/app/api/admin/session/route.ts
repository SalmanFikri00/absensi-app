import { NextResponse } from 'next/server';
import { adminCookieName, isAdminRequest, makeAdminSession, verifyAdminPin } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return NextResponse.json({ authenticated: isAdminRequest(request) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { pin?: unknown };
    if (!verifyAdminPin(body.pin)) return NextResponse.json({ error: 'PIN petugas tidak sesuai.' }, { status: 401 });
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(adminCookieName, makeAdminSession(), {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
      path: '/', maxAge: 8 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
}

export function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminCookieName, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
