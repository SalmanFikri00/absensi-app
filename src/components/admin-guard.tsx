'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, BadgeCheck, Camera, ClipboardList, KeyRound, LogOut, Users, WifiOff } from 'lucide-react';

export function AdminGuard({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function refreshSession() {
    try {
      const response = await fetch('/api/admin/session', { cache: 'no-store' });
      const data = await response.json();
      setAuthenticated(Boolean(data.authenticated));
    } catch { setAuthenticated(false); }
  }

  useEffect(() => { void refreshSession(); }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'PIN tidak sesuai.');
      setAuthenticated(true); setPin(''); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Tidak dapat masuk.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setAuthenticated(false); router.push('/admin');
  }

  if (authenticated === null) return <main className="center-state"><div className="loader" /><span>Memeriksa sesi petugas…</span></main>;
  if (!authenticated) return (
    <main className="login-page">
      <div className="login-side">
        <Link href="/" className="brand brand-light"><span className="brand-mark"><Activity size={19} /></span><span>pos<span>hadir</span></span><i>FIELD OPS</i></Link>
        <div className="login-copy"><span className="eyebrow">RUANG KENDALI LOKAL</span><h1>Siap jaga<br />pintu masuk.</h1><p>Kelola absensi lapangan secara langsung—data tetap tersimpan meski jaringan internet terputus.</p><div className="offline-pill"><WifiOff size={15} /> Server edge aktif · data tersimpan lokal</div></div>
        <div className="login-foot">POSHADIR · OFFLINE-FIRST ATTENDANCE</div>
      </div>
      <div className="login-form-wrap"><form className="login-form" onSubmit={signIn}>
        <div className="form-icon"><KeyRound size={22} /></div><span className="eyebrow">AKSES PETUGAS</span><h2>Masuk ke PosHadir</h2><p>Masukkan PIN petugas untuk membuka dashboard dan pemindai QR.</p>
        <label htmlFor="admin-pin">PIN petugas</label><input id="admin-pin" className="pin-input" inputMode="numeric" autoComplete="current-password" type="password" maxLength={12} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" autoFocus />
        {error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide" disabled={busy || !pin}>{busy ? 'Memeriksa…' : 'Masuk dashboard'}</button><Link className="back-link" href="/">← Kembali ke beranda</Link>
      </form></div>
    </main>
  );

  return <div className="admin-layout"><aside className="sidebar">
    <Link href="/admin" className="brand"><span className="brand-mark"><Activity size={19} /></span><span>pos<span>hadir</span></span><i>FIELD OPS</i></Link>
    <div className="side-label">WORKSPACE</div>
    <Link className={`side-link ${pathname === '/admin' ? 'active' : ''}`} href="/admin"><ClipboardList size={18} /> Ringkasan</Link>
    <Link className={`side-link ${pathname.startsWith('/admin/scan') ? 'active' : ''}`} href="/admin/scan"><Camera size={18} /> Pemindai QR <span className="live-dot" /></Link>
    <Link className={`side-link ${pathname.startsWith('/admin/users') ? 'active' : ''}`} href="/admin/users"><Users size={18} /> Manajemen pengguna</Link>
    <div className="sidebar-spacer" />
    <div className="side-status"><span className="status-dot" /><div><b>Node lokal aktif</b><small>Data tersimpan di perangkat</small></div></div>
    <button className="side-logout" onClick={signOut}><LogOut size={16} /> Keluar</button>
    <div className="sidebar-foot">POSHADIR · ABSENSI LOKAL</div>
  </aside><div className="admin-main"><header className="mobile-admin-head"><Link href="/admin" className="brand"><span className="brand-mark"><Activity size={18} /></span><span>pos<span>hadir</span></span></Link><button className="icon-button" onClick={signOut} aria-label="Keluar"><LogOut size={18} /></button></header><nav className="mobile-admin-nav"><Link href="/admin" className={pathname === '/admin' ? 'active' : ''}><ClipboardList size={15} /> Ringkasan</Link><Link href="/admin/scan" className={pathname.startsWith('/admin/scan') ? 'active' : ''}><Camera size={15} /> Pemindai</Link><Link href="/admin/users" className={pathname.startsWith('/admin/users') ? 'active' : ''}><Users size={15} /> Pengguna</Link></nav>{children}</div></div>;
}

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
