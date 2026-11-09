'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Pencil, Plus, Search, ShieldCheck, UserCheck, UserRound, UserRoundX, Users, X } from 'lucide-react';
import { AdminGuard, PageHeading } from '@/components/admin-guard';
type Worker = { id: string; name: string; division: string; active: number; created_at: string };
type FormState = { id: string; name: string; division: string; pin: string };
const emptyForm: FormState = { id: '', name: '', division: '', pin: '' };
function UsersPageContent() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/workers', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Daftar pekerja tidak dapat dimuat.');
      setWorkers(data.workers ?? []); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Koneksi ke server lokal terputus.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const activeCount = workers.filter((worker) => worker.active === 1).length;
  const filtered = useMemo(() => workers.filter((worker) => `${worker.name} ${worker.id} ${worker.division}`.toLowerCase().includes(query.toLowerCase())), [workers, query]);
  function startCreate() { setEditingId(''); setForm(emptyForm); setActive(true); setError(''); setNotice(''); setShowForm(true); }
  function startEdit(worker: Worker) { setEditingId(worker.id); setForm({ id: worker.id, name: worker.name, division: worker.division, pin: '' }); setActive(worker.active === 1); setError(''); setNotice(''); setShowForm(true); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId ? { id: editingId, name: form.name, division: form.division, active, ...(form.pin ? { pin: form.pin } : {}) } : { id: form.id.trim().toUpperCase(), name: form.name, division: form.division, pin: form.pin };
      const response = await fetch('/api/admin/workers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Akun tidak dapat disimpan.');
      setNotice(editingId ? `Perubahan akun ${data.worker.id} tersimpan.` : `Akun ${data.worker.id} berhasil dibuat.`);
      setShowForm(false); setEditingId(''); setForm(emptyForm); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Akun tidak dapat disimpan.'); }
    finally { setSaving(false); }
  }
  async function toggleStatus(worker: Worker) {
    setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/workers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: worker.id, name: worker.name, division: worker.division, active: worker.active !== 1 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Status akun tidak dapat diubah.');
      setWorkers((current) => current.map((item) => item.id === worker.id ? data.worker : item));
      setNotice(`${worker.name} ${data.worker.active ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Status akun tidak dapat diubah.'); }
  }
  return <div className="admin-content user-management">
    <PageHeading eyebrow="AKUN & AKSES · SITE 04" title="Manajemen pengguna" subtitle="Kelola akun pekerja yang dapat masuk ke portal absensi." action={<button className="button button-primary" onClick={startCreate}><Plus size={15} /> Tambah pekerja</button>} />
    <div className="user-summary"><div className="user-summary-icon"><Users size={19} /></div><div><b>{activeCount} akun aktif</b><span>{workers.length} pekerja terdaftar · PIN tidak ditampilkan</span></div><span className="user-summary-secure"><ShieldCheck size={14} /> AKSES TERKONTROL</span></div>
    {error && <div className="inline-alert">{error}</div>}{notice && <div className="user-notice"><Check size={15} /> {notice}</div>}
    {showForm && <section className="user-form-panel"><div className="user-form-heading"><div><span className="eyebrow">{editingId ? 'PERBARUI AKUN' : 'AKUN BARU'}</span><h2>{editingId ? `Ubah ${editingId}` : 'Tambah pekerja'}</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Tutup formulir"><X size={17} /></button></div>
      <form onSubmit={submit} className="user-form-grid">
        <div className="user-field"><label htmlFor="user-id">ID pekerja</label><input id="user-id" value={form.id} disabled={Boolean(editingId)} placeholder="EMP-011" maxLength={24} onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })} required /></div>
        <div className="user-field"><label htmlFor="user-name">Nama lengkap</label><input id="user-name" value={form.name} placeholder="Nama pekerja" maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="user-field"><label htmlFor="user-division">Divisi</label><input id="user-division" value={form.division} placeholder="Contoh: Operasional" maxLength={80} onChange={(e) => setForm({ ...form, division: e.target.value })} required /></div>
        <div className="user-field"><label htmlFor="user-pin">{editingId ? 'PIN baru (opsional)' : 'PIN awal'}</label><input id="user-pin" type="password" inputMode="numeric" autoComplete="new-password" value={form.pin} placeholder={editingId ? 'Kosongkan jika tidak diubah' : '4–8 digit'} minLength={4} maxLength={8} pattern="[0-9]{4,8}" onChange={(e) => setForm({ ...form, pin: e.target.value })} required={!editingId} /><small>{editingId ? 'PIN lama tidak dapat dilihat.' : 'Sampaikan PIN kepada pekerja secara terpisah.'}</small></div>
        {editingId && <label className="user-active-toggle"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span className="toggle-visual" /><span>Akun aktif — dapat masuk ke portal</span></label>}
        <div className="user-form-actions"><button type="button" className="button button-outline" onClick={() => setShowForm(false)}>Batal</button><button className="button button-dark" disabled={saving}>{saving ? 'Menyimpan…' : <><Check size={15} /> Simpan akun</>}</button></div>
      </form>
    </section>}
    <section className="user-table-panel"><div className="user-table-heading"><div><span className="eyebrow">DIREKTORI PEKERJA</span><h2>Akun portal</h2></div><label className="user-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, ID, divisi" /></label></div>
      <div className="table-scroll"><table><thead><tr><th>PEKERJA</th><th>DIVISI</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{loading ? <tr><td colSpan={4}><div className="empty-table"><b>Memuat daftar pekerja…</b></div></td></tr> : filtered.length ? filtered.map((worker) => <tr key={worker.id}><td><div className="table-person"><span className="mini-avatar">{worker.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><b>{worker.name}</b><small>{worker.id}</small></div></div></td><td><span className="division-pill">{worker.division}</span></td><td><span className={`worker-status ${worker.active ? 'active' : ''}`}><i />{worker.active ? 'Aktif' : 'Nonaktif'}</span></td><td><div className="user-row-actions"><button className="user-action" onClick={() => startEdit(worker)} title="Ubah akun" aria-label={`Ubah ${worker.name}`}><Pencil size={14} /> Ubah</button><button className={`user-action ${worker.active ? 'deactivate' : 'activate'}`} onClick={() => void toggleStatus(worker)} title={worker.active ? 'Nonaktifkan akun' : 'Aktifkan akun'} aria-label={`${worker.active ? 'Nonaktifkan' : 'Aktifkan'} ${worker.name}`}>{worker.active ? <><UserRoundX size={14} /> Nonaktifkan</> : <><UserCheck size={14} /> Aktifkan</>}</button></div></td></tr>) : <tr><td colSpan={4}><div className="empty-table"><span className="empty-icon"><UserRound size={18} /></span><b>Tidak ada pekerja yang cocok</b><small>Coba kata kunci lain atau tambahkan akun baru.</small></div></td></tr>}</tbody></table></div>
      <div className="panel-foot"><span><span className="status-dot" /> Data akun tersimpan di server lokal</span><span>{filtered.length} dari {workers.length} akun</span></div>
    </section>
    <div className="user-security-note"><span><KeyRound size={15} /></span><p><b>Keamanan akun.</b> PIN disimpan dalam bentuk hash, tidak dapat dibaca dari panel. Jika pekerja lupa PIN, ubah akun untuk menetapkan PIN baru.</p></div>
  </div>;
}
export default function AdminUsersPage() { return <AdminGuard><UsersPageContent /></AdminGuard>; }
