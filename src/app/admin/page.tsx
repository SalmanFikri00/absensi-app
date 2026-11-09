'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowDownToLine, BadgeCheck, Clock3, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react';
import { AdminGuard, PageHeading } from '@/components/admin-guard';

type Row = { id: number; user_id: string; name: string; division: string; check_in_time: string; synced: number };
type Overview = { workers: number; present: number; pending: number; recent: Row[]; syncConfigured: boolean; networkOnline: boolean };
function atTime(value: string) { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
function todayText() { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()); }

function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  async function load() {
    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (response.status === 401) { setError('Sesi berakhir. Silakan masuk kembali.'); return; }
      const next = await response.json(); setData(next); setUpdated(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())); setError('');
    } catch { setError('Koneksi ke server lokal terputus.'); }
  }
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 6000); return () => window.clearInterval(id); }, []);
  const rate = data?.workers ? Math.round((data.present / data.workers) * 100) : 0;
  return <div className="admin-content"><PageHeading eyebrow="DASHBOARD · SITE 04" title="Ringkasan kehadiran" subtitle={todayText()} action={<button className="button button-outline" onClick={() => void load()}><RefreshCw size={15} /> Perbarui</button>} />
    {error && <div className="inline-alert">{error}</div>}
    <div className="status-banner"><div className="status-banner-icon">{data?.syncConfigured && data.networkOnline ? <Wifi size={19} /> : <WifiOff size={19} />}</div><div className="status-banner-copy"><b>{data?.syncConfigured ? (data.networkOnline ? 'Internet tersedia · sync aktif' : 'Offline mode · operasi lokal aktif') : 'Mode lokal · koneksi internet tidak diperlukan'}</b><span>{data?.syncConfigured ? (data.networkOnline ? 'Worker memeriksa antrean sinkronisasi otomatis.' : 'Data tetap masuk ke SQLite; sinkronisasi akan mencoba lagi saat online.') : 'Data tersimpan di SQLite pada perangkat ini. Webhook cloud belum dikonfigurasi.'}</span></div><span className="local-label"><i /> SERVER EDGE AKTIF</span></div>
    <div className="stat-grid"><article className="stat-card stat-present"><div className="stat-card-top"><span>HADIR HARI INI</span><span className="stat-icon"><BadgeCheck size={18} /></span></div><div className="stat-value">{data ? data.present : '—'}<small> / {data?.workers ?? '—'}</small></div><div className="stat-bottom"><div className="stat-progress"><i style={{ width: `${rate}%` }} /></div><span>{data ? `${rate}%` : 'Memuat…'}</span></div></article><article className="stat-card"><div className="stat-card-top"><span>TOTAL PEKERJA</span><span className="stat-icon"><Users size={18} /></span></div><div className="stat-value">{data?.workers ?? '—'}<small> pekerja</small></div><div className="stat-note">Terdaftar pada node lokal</div></article><article className="stat-card"><div className="stat-card-top"><span>ANTREAN SYNC</span><span className="stat-icon amber-icon"><ArrowDownToLine size={18} /></span></div><div className="stat-value">{data?.pending ?? '—'}<small> data</small></div><div className="stat-note">{data?.syncConfigured ? 'Menunggu konfirmasi cloud' : 'Tersimpan lokal · endpoint belum diatur'}</div></article></div>
    <section className="log-panel"><div className="panel-heading"><div><span className="eyebrow">AKTIVITAS LAPANGAN</span><h2>Log check-in terbaru</h2></div><div className="live-refresh"><span className="live-dot" /> LIVE <span>· diperbarui {updated || '—'}</span></div></div>
      <div className="table-scroll"><table><thead><tr><th>PEKERJA</th><th>DIVISI</th><th>WAKTU</th><th>STATUS SYNC</th></tr></thead><tbody>{data?.recent.length ? data.recent.map((row) => <tr key={row.id}><td><div className="table-person"><span className="mini-avatar">{row.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</span><div><b>{row.name}</b><small>{row.user_id}</small></div></div></td><td><span className="division-pill">{row.division}</span></td><td><span className="time-cell"><Clock3 size={14} /> {atTime(row.check_in_time)} WIB</span></td><td><span className={`sync-pill ${row.synced ? 'synced' : ''}`}><i /> {row.synced ? 'Tersinkron' : 'Tersimpan lokal'}</span></td></tr>) : <tr><td colSpan={4}><div className="empty-table"><span className="empty-icon"><Activity size={19} /></span><b>{data ? 'Belum ada check-in hari ini' : 'Memuat aktivitas…'}</b><small>Scan QR pekerja untuk mencatat kehadiran.</small></div></td></tr>}</tbody></table></div>
      <div className="panel-foot"><span><span className="status-dot" /> SQLite lokal · mode WAL aktif</span><span>Data disimpan di perangkat edge</span></div>
    </section><div className="dashboard-note"><span><WifiOff size={15} /></span><p><b>Offline-first, tanpa jeda.</b> Koneksi cloud bersifat opsional. Absensi tetap dapat digunakan ketika internet mati.</p></div>
  </div>;
}

export default function AdminDashboard() { return <AdminGuard><Dashboard /></AdminGuard>; }
