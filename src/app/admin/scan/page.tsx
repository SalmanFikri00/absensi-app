'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertTriangle, BadgeCheck, Camera, Check, CircleAlert, Clock3, Keyboard, RefreshCw, ScanLine, Volume2, WifiOff } from 'lucide-react';
import { AdminGuard, PageHeading } from '@/components/admin-guard';

type ScanResult = { status: 'success' | 'duplicate' | 'invalid' | 'error' | 'unauthorized'; message: string; worker?: { name: string; id: string }; time?: string };
function displayTime(value?: string) { return value ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value)) : ''; }

function Scanner() {
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef({ value: '', at: 0 });

  const beep = useCallback((success: boolean) => {
    try {
      const audio = new AudioContext(); const oscillator = audio.createOscillator(); const gain = audio.createGain();
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = success ? 920 : 380; gain.gain.value = 0.09;
      oscillator.start(); oscillator.stop(audio.currentTime + (success ? 0.13 : 0.22)); oscillator.onended = () => void audio.close();
    } catch { /* audio is optional */ }
  }, []);

  const processPayload = useCallback(async (payload: string) => {
    const now = Date.now();
    if (!payload || busyRef.current || (lastScanRef.current.value === payload && now - lastScanRef.current.at < 1500)) return;
    busyRef.current = true; lastScanRef.current = { value: payload, at: now }; setBusy(true);
    try {
      const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload }) });
      const data = await response.json() as ScanResult;
      setResult(data); beep(data.status === 'success');
    } catch {
      setResult({ status: 'error', message: 'Server lokal tidak merespons. Coba lagi.' }); beep(false);
    }
    window.setTimeout(() => { busyRef.current = false; setBusy(false); }, 1500);
  }, [beep]);

  useEffect(() => {
    let active = true;
    const scanner = new Html5Qrcode('qr-reader', { verbose: false }); scannerRef.current = scanner;
    void scanner.start({ facingMode: 'environment' }, { fps: 12, qrbox: (width, height) => {
      const size = Math.floor(Math.min(width, height) * 0.82);
      return { width: size, height: size };
    } }, (decoded) => void processPayload(decoded), () => {}).then(() => {
      if (active) setCameraReady(true);
    }).catch((err: unknown) => {
      if (!active) return;
      const reason = err instanceof Error ? err.message : '';
      setCameraError(reason.toLowerCase().includes('secure') || reason.toLowerCase().includes('https')
        ? 'Browser meminta koneksi HTTPS untuk mengaktifkan kamera. Gunakan input QR manual sementara, atau aktifkan HTTPS pada jaringan lokal.'
        : 'Kamera tidak dapat dibuka. Izinkan akses kamera pada browser atau gunakan input QR manual.');
    });
    return () => { active = false; if (scanner.isScanning) void scanner.stop().then(() => scanner.clear()).catch(() => {}); else scanner.clear(); };
  }, [processPayload]);

  async function manualSubmit(event: FormEvent) { event.preventDefault(); await processPayload(manual.trim()); setManual(''); }
  const success = result?.status === 'success';
  const duplicate = result?.status === 'duplicate';
  const invalid = result && !success && !duplicate;

  return <div className="admin-content"><PageHeading eyebrow="PETUGAS · PEMINDAI" title="Pindai QR pekerja" subtitle="Arahkan kamera ke kartu QR pekerja. Check-in tersimpan langsung di server lokal." action={<div className={`camera-status ${cameraReady ? 'camera-on' : ''}`}><span className="status-dot" /> {cameraReady ? 'KAMERA AKTIF' : 'MENYIAPKAN KAMERA'}</div>} />
    <div className="scanner-grid"><section className="scanner-panel"><div className="scanner-panel-head"><div><span className="eyebrow">SCANNER POS JAGA</span><b>Pos masuk · Site 04</b></div><span className="scanner-live"><i /> SIAP SCAN</span></div>
      <div className={`scanner-view ${success ? 'scan-success' : duplicate ? 'scan-duplicate' : invalid ? 'scan-invalid' : ''}`}><div id="qr-reader" className="qr-reader" /><div className="scanner-overlay"><div className="scan-corner tl" /><div className="scan-corner tr" /><div className="scan-corner bl" /><div className="scan-corner br" /><div className="scan-line" /></div>{!cameraReady && !cameraError && <div className="camera-loading"><div className="loader" /><span>Meminta akses kamera…</span></div>}{cameraError && <div className="camera-fallback"><span className="fallback-icon"><Camera size={22} /></span><b>Kamera belum tersedia</b><p>{cameraError}</p></div>}{result && <div className={`scan-feedback ${success ? 'feedback-success' : duplicate ? 'feedback-duplicate' : 'feedback-error'}`}><span>{success ? <BadgeCheck size={22} /> : duplicate ? <AlertTriangle size={22} /> : <CircleAlert size={22} />}</span><div><b>{result.message}</b>{result.worker && <small>{result.worker.id}{result.time ? ` · ${displayTime(result.time)} WIB` : ''}</small>}</div></div>}</div>
      <div className="scanner-tip"><ScanLine size={16} /><span>{busy ? 'Menyimpan check-in…' : 'Posisikan QR memenuhi kotak dan hindari pantulan layar. Scanner siap membaca QR berikutnya dalam 1,5 detik.'}</span><Volume2 size={16} /></div>
      <form className="manual-scan" onSubmit={manualSubmit}><label htmlFor="manual-payload"><Keyboard size={15} /> Input payload QR manual</label><div><input id="manual-payload" value={manual} onChange={(e) => setManual(e.target.value)} placeholder='Tempel isi QR, contoh: {"uid":"EMP-001", ...}' /><button className="button button-dark" disabled={!manual.trim() || busy}>Proses</button></div></form>
    </section><aside className="scan-aside"><div className="aside-card"><span className="aside-icon"><WifiOff size={17} /></span><span className="eyebrow">MODE OPERASI</span><b>Jaringan lokal aktif</b><p>Setiap check-in ditulis ke SQLite di perangkat ini. Internet tidak dibutuhkan untuk scan.</p><div className="aside-divider" /><div className="aside-row"><span>Proteksi scan ganda</span><b><Check size={14} /> Aktif</b></div><div className="aside-row"><span>Validasi QR</span><b><Check size={14} /> HMAC</b></div><div className="aside-row"><span>Siap scan lagi</span><b><RefreshCw size={13} /> 1,5 dtk</b></div></div><div className="aside-help"><Clock3 size={16} /><p><b>Waktu operasional</b><br />Waktu tercatat otomatis menggunakan zona WIB (Asia/Jakarta).</p></div></aside></div>
  </div>;
}

export default function ScanPage() { return <AdminGuard><Scanner /></AdminGuard>; }
