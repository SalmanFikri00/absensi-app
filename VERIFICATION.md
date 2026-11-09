# Verifikasi PosHadir — login & manajemen pengguna

## Berhasil di sandbox

- `bun run typecheck` — lulus.
- Production build — lulus tanpa warning; Next.js 15.5.29 menghasilkan standalone output di Bun.
- `bun run test:smoke` — **30/30 checks lulus**: halaman `/`, `/user`, `/admin`, `/admin/users`, `/admin/scan`; direktori pekerja/admin API terlindungi; login admin; login pekerja ID + PIN; pemulihan sesi; QR valid; check-in; anti-duplikasi; QR palsu; ringkasan dashboard; pembuatan akun; penolakan ID duplikat; ubah divisi/reset PIN; penolakan akun nonaktif; pencabutan sesi pada logout/reset PIN/nonaktif; serta aktivasi ulang tidak menghidupkan token lama.
- Migrasi SQLite versi lama — lulus pada database sementara berisi schema `users` lama dan satu log absensi. Akun, akses PIN lama, dan riwayat absensi dipertahankan; PIN plaintext dihapus dan diganti hash scrypt bersalt.
- Preview production — route pekerja/admin dan aset CSS berhasil dilayani.
- Browser E2E production (Chromium terisolasi) — lulus: login admin membuka direktori pekerja; tombol tambah membuka formulir; login pekerja membuka QR tanpa kontrol Ganti profil/Kembali; sesi pulih setelah reload; logout kembali ke halaman login. Tidak ada exception JavaScript pada alur ini.
- Tes memakai database sementara; data proyek asli tidak diubah oleh tes.

## Perubahan alur

Pekerja masuk dengan ID dan PIN; daftar nama publik, tombol **Ganti profil**, serta tautan **Kembali** di portal pekerja sudah dihapus. Setelah login hanya ada identitas akun dan aksi **Keluar**. Sesi worker HTTP-only berlaku paling lama 12 jam, token disimpan dalam bentuk hash di SQLite dan dapat dicabut di server. Status akun/kehadiran diperbarui otomatis setiap 15 detik.

Admin memiliki menu **Manajemen pengguna** di desktop dan **Pengguna** di navigasi mobile. Admin dapat membuat akun, mencari pekerja, mengubah nama/divisi, reset PIN, serta aktif/nonaktifkan akun tanpa menghapus riwayat absensi.

## Belum diverifikasi

- Docker image/Compose belum dibuild atau dijalankan karena Docker CLI/engine belum tersedia di sandbox.
- Belum dipasang atau diuji di Orange Pi; tidak ada akses board/SSH yang diberikan.
- Kamera ponsel fisik dan koneksi LAN lapangan belum diuji. HTTP berbasis IP LAN dapat ditolak browser untuk izin kamera; gunakan HTTPS lokal Caddy atau fallback input QR manual.

## Sebelum uji lapangan

Ganti `ADMIN_PIN`, `ADMIN_SESSION_SECRET`, dan `QR_SECRET` di environment; ganti PIN akun seed melalui menu admin. Akun admin masih menggunakan satu PIN bersama, bukan multi-admin/role granular. Siapkan backup volume SQLite dan HTTPS/sertifikat tepercaya untuk perangkat scanner. Proyek ini belum dideploy ke perangkat produksi.
