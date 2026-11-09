'use client';
import { FormEvent, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, BadgeCheck, Check, Clock3, LockKeyhole, LogOut, QrCode, UserRound } from 'lucide-react';
type Worker = { id: string; name: string; division: string };
type Profile = { worker: Worker; qr: string; attendance: { checkedIn: boolean; time?: string } };
function timeLabel(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}
export default function UserPortal() {
  const [workerId, setWorkerId] = useState('');
  const [pin, setPin] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as Profile;
    }).then((data) => setProfile(data)).catch(() => setError('Server lokal belum dapat dijangkau. Coba muat ulang halaman.'))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    if (!profile?.worker.id) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        if (response.status === 401 || response.status === 403) {
          setProfile(null); setError('Sesi berakhir atau akses akun diubah. Silakan masuk kembali.'); return;
        }
        if (response.ok) setProfile(await response.json());
      } catch { /* Keep the current card available during a temporary LAN interruption. */ }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [profile?.worker.id]);
  async function enter(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workerId.trim().toUpperCase(), pin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tidak dapat masuk.');
      setProfile(data); setPin(''); window.scrollTo({ top: 0 });
    } catch (err) { setError(err instanceof Error ? err.message : 'Tidak dapat masuk.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/profile', { method: 'DELETE' });
      if (!response.ok) throw new Error('Tidak dapat keluar. Coba lagi.');
      setProfile(null); setWorkerId(''); setPin(''); window.scrollTo({ top: 0 });
    } catch { setError('Server lokal tidak dapat dijangkau. Coba keluar lagi.'); }
    finally { setBusy(false); }
  }
  return <main className="portal-page">
    <header className="portal-nav wrap">
      <div className="brand"><span className="brand-mark"><Activity size={19} /></span><span>pos<span>hadir</span></span><i>FIELD OPS</i></div>
      <div className="portal-nav-right">{profile && <><span className="account-chip"><span className="status-dot" />{profile.worker.name}</span><button className="portal-logout" disabled={busy} onClick={() => void signOut()}><LogOut size={14} /> Keluar</button></>}{!profile && <span className="nav-status"><span className="status-dot" /> LOKAL AKTIF</span>}</div>
    </header>
    <div className="portal-wrap">
      {profile && error && <div className="inline-alert">{error}</div>}
      {!profile ? <div className="portal-intro">
        <div className="portal-title"><div className="portal-title-icon"><QrCode size={21} /></div><span className="eyebrow">AKUN PEKERJA</span><h1>Siap bekerja.<br />Siap tercatat.</h1><p>Masuk dengan ID pekerja dan PIN untuk membuka kartu absensi personal Anda.</p><div className="login-assurance"><span><Check size={14} /> Akun dikelola admin</span><span><LockKeyhole size={14} /> Sesi aman di server lokal</span></div></div>
        <form className="worker-form" onSubmit={enter}>
          <div className="form-head"><UserRound size={17} /><b>Masuk ke portal pekerja</b><span>01 / 01</span></div>
          <label htmlFor="worker-id">ID pekerja</label><div className="input-with-icon"><UserRound size={16} /><input id="worker-id" type="text" autoComplete="username" autoCapitalize="characters" maxLength={24} placeholder="Contoh: EMP-001" value={workerId} onChange={(e) => setWorkerId(e.target.value.toUpperCase())} required /></div>
          <label htmlFor="worker-pin">PIN personal</label><div className="input-with-icon"><LockKeyhole size={16} /><input id="worker-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={8} placeholder="Masukkan PIN" value={pin} onChange={(e) => setPin(e.target.value)} required /></div>
          <div className="form-hint"><span className="hint-check"><Check size={11} /></span> Tidak punya akses? Hubungi admin untuk akun Anda.</div>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-dark button-wide" disabled={busy || !workerId.trim() || !pin}>{busy ? 'Memeriksa akun…' : <>Masuk ke portal <QrCode size={16} /></>}</button>
        </form>
      </div> : <div className="worker-card-wrap"><div className="worker-card-head"><div><span className="eyebrow">KARTU IDENTITAS DIGITAL</span><h1>Halo, {profile.worker.name.split(' ')[0]}.</h1><p>Pastikan QR terlihat jelas saat dipindai petugas.</p></div></div>
        <article className="worker-card"><div className="worker-card-top"><span>POSHADIR <i>·</i> WORKER PASS</span><span className="card-site"><span className="status-dot" /> SITE 04</span></div><div className="identity-row"><div className="worker-avatar">{profile.worker.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div><div><h2>{profile.worker.name}</h2><span>{profile.worker.division}</span></div><strong className="worker-id">{profile.worker.id}</strong></div><div className="qr-stage"><div className="qr-box"><QRCodeSVG value={profile.qr} size={204} level="H" includeMargin /></div><div className="qr-caption"><b><QrCode size={16} /> QR PERSONAL</b><span>Perlihatkan kode ini ke petugas</span></div></div><div className={`attendance-state ${profile.attendance.checkedIn ? 'is-present' : 'is-waiting'}`}><div className="attendance-state-icon">{profile.attendance.checkedIn ? <BadgeCheck size={19} /> : <Clock3 size={19} />}</div><div><b>{profile.attendance.checkedIn ? 'Sudah check-in hari ini' : 'Belum check-in'}</b><span>{profile.attendance.checkedIn ? `Tercatat pukul ${timeLabel(profile.attendance.time)} WIB` : 'Petugas akan memindai QR Anda di pos.'}</span></div><div className="state-pill">{profile.attendance.checkedIn ? 'HADIR' : 'MENUNGGU'}</div></div><div className="worker-card-foot"><span><LockKeyhole size={13} /> QR dilindungi tanda tangan digital</span><span>Disimpan lokal · aman offline</span></div></article>
        <div className="portal-tip"><div><BadgeCheck size={17} /></div><p><b>Tips scan cepat</b><br />Naikkan kecerahan layar dan tahan ponsel sekitar 15–25 cm dari kamera petugas.</p></div>
      </div>}
      {busy && !profile && <div className="portal-loading"><span className="loader" /> Memeriksa sesi pekerja…</div>}
      <footer className="portal-footer">POSHADIR <i>·</i> SISTEM ABSENSI LOKAL <span>Asia/Jakarta · WIB</span></footer>
    </div>
  </main>;
}
