# PosHadir — MVP Absensi Lapangan Offline

MVP absensi QR self-hosted untuk jaringan lokal/area tanpa internet. Aplikasi berjalan sebagai Next.js standalone di Bun, menyimpan transaksi ke SQLite (WAL), dan opsional mendorong antrean ke webhook saat internet tersedia.

## Yang tersedia

- Portal pekerja `/user`: login dengan ID pekerja + PIN, sesi tersimpan dalam cookie HTTP-only selama 12 jam, kartu identitas dan QR bertanda tangan HMAC, serta status kehadiran hari itu.
- Area petugas `/admin`: login PIN, ringkasan total hadir/kuota/antrean, dan log check-in yang diperbarui berkala.
- Manajemen pengguna `/admin/users`: buat akun pekerja, cari akun, ubah nama/divisi, reset PIN, dan aktif/nonaktifkan akses tanpa menghapus riwayat absensi.
- Pemindai `/admin/scan`: kamera browser (`html5-qrcode`), bunyi dan feedback visual, validasi QR, serta proteksi satu kali check-in per pekerja per tanggal WIB. Ada input payload manual jika izin kamera tidak tersedia.
- SQLite lokal dengan WAL, foreign key, indeks, seed 10 pekerja demo, dan volume persisten Docker. PIN pekerja disimpan sebagai hash scrypt dengan salt; database versi lama dimigrasikan otomatis tanpa menghapus absensi.
- Worker sync terpisah yang mencoba setiap 15 detik, mengirim paling banyak 50 record, dan menandai hanya ID yang diterima oleh webhook.
- Docker Compose untuk aplikasi + worker; TLS lokal Caddy tersedia sebagai profile opsional.

## Jalankan di Orange Pi dengan Docker

Workflow GitHub Actions memeriksa tipe dan menjalankan smoke test, lalu membangun image multi-arsitektur (`linux/arm64` dan `linux/amd64`) dan menerbitkannya ke `ghcr.io/salmanfikri00/absensi-app`. Push ke `main` menghasilkan tag `latest` dan `sha-<commit>`; tag Git `v*` juga diterbitkan. Build berjalan di runner GitHub Actions—Orange Pi tidak perlu source code atau compiler.

Package GHCR dibiarkan **private**. Sebelum pull pertama di Orange Pi, buat GitHub Personal Access Token classic dengan izin `read:packages`, lalu login ke GHCR (token diminta pada prompt password; jangan simpan di repository atau `.env`):

```bash
docker login ghcr.io -u SalmanFikri00
```

Gunakan Orange Pi dengan Docker Engine dan Docker Compose plugin, tersambung ke jaringan Wi-Fi/LAN yang sama dengan ponsel petugas dan pekerja. Pastikan OS-nya 64-bit (`uname -m` menampilkan `aarch64`); dari folder yang berisi file Compose:

```bash
cp .env.example .env
```

Edit `.env` dan ganti `ADMIN_PIN`, `ADMIN_SESSION_SECRET`, dan `QR_SECRET` dengan nilai unik (gunakan secret acak yang panjang). Lalu tarik image dan jalankan:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Aplikasi tersedia pada `http://IP-ORANGE-PI:3000` (atau port `APP_PORT` jika diubah). Buka `/user` untuk pekerja dan `/admin` untuk petugas. Seed demo memakai ID pekerja `EMP-001` hingga `EMP-010` dengan PIN `1234`; PIN petugas mengikuti nilai `ADMIN_PIN` pada `.env` (nilai contoh `2468`). Ganti kredensial demo sebelum pemakaian nyata.

SQLite berada di named volume `attendance-data` dan bertahan setelah container diperbarui. Jangan menghapus volume ketika melakukan rebuild. Periksa log dengan `docker compose logs -f web sync-worker`.

Untuk memperbarui ke image terbaru setelah workflow berhasil, jalankan `docker compose pull && docker compose up -d`. Image dapat dipatok ke versi/commit tertentu dengan mengatur `GHCR_IMAGE` (contoh: `ghcr.io/salmanfikri00/absensi-app:sha-<commit>`).

### Kamera browser melalui HTTPS lokal

Browser ponsel modern dapat menolak kamera pada alamat HTTP berbasis IP lokal, walaupun aplikasi tetap dapat dipakai. Untuk kamera, nama lokal `absensi.local` harus mengarah ke Orange Pi melalui mDNS/DNS lokal. Setelah nama perangkat/DNS lokal disiapkan, di `.env` set `COOKIE_SECURE=true`, lalu jalankan:

```bash
docker compose --profile tls pull
docker compose --profile tls up -d
```

Caddy menyediakan HTTPS dengan CA internal. Perangkat klien harus mempercayai sertifikat root Caddy sebelum browser menganggap situs sebagai secure context dan memberi izin kamera. Root sertifikat dapat diambil dengan:

```bash
docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt
```

Instal sertifikat itu sebagai CA tepercaya di ponsel yang dipakai sebagai scanner, lalu buka `https://absensi.local/admin/scan`. Jika belum memasang TLS/CA, gunakan input payload QR manual di halaman scanner. Akses HTTP port 3000 tetap tersedia.

## Kelola akun pekerja

Masuk ke `/admin`, lalu buka **Manajemen pengguna**. Pilih **Tambah pekerja** dan isi ID unik berformat `EMP-...`, nama, divisi, serta PIN awal 4–8 digit. Pekerja masuk lewat `/user` menggunakan ID dan PIN tersebut; tidak ada lagi daftar nama publik atau tombol ganti profil.

Gunakan **Ubah** untuk memperbarui nama/divisi atau menetapkan PIN baru. Kolom PIN kosong berarti PIN lama tidak diubah. ID akun tidak dapat diganti. Reset PIN mencabut semua sesi aktif akun tersebut. Tombol **Nonaktifkan** langsung menolak login, sesi portal, dan pemindaian QR milik akun tersebut; riwayat absensinya tetap tersimpan. Akun dapat diaktifkan kembali, tetapi token sesi lama tidak berlaku lagi. Tombol **Keluar** mencabut sesi perangkat saat ini di server. Portal memperbarui status akun/kehadiran setiap 15 detik. Admin tidak dapat melihat PIN yang tersimpan.

## Sinkronisasi webhook (opsional)

Tanpa `CLOUD_WEBHOOK_URL`, data tetap lokal dan worker tidak mengirim apa pun. Untuk mengaktifkan sync, isi `CLOUD_WEBHOOK_URL` dan (bila perlu) `CLOUD_WEBHOOK_TOKEN` di `.env`, lalu `docker compose up -d`. Worker hanya melakukan POST ketika probe internet berhasil.

Payload yang dikirim:

```json
{
  "records": [
    {
      "id": 1,
      "user_id": "EMP-001",
      "user_name": "Ari Pratama",
      "division": "Operasional",
      "check_in_time": "2026-11-10T01:00:00.000Z",
      "check_in_date": "2026-11-10",
      "idempotency_key": "EMP-001:2026-11-10"
    }
  ]
}
```

Jika token diatur, worker mengirim `Authorization: Bearer <token>`. Endpoint harus mengembalikan HTTP 2xx dengan JSON `{ "committed_ids": [1] }`; hanya ID yang ada dalam batch dan dikonfirmasi di respons akan ditandai tersinkron. Endpoint cloud tetap perlu menerapkan idempotensi `user_id + check_in_date`.

## Pengembangan dan tes

Membutuhkan Bun 1.1+ dan koneksi internet saat mengunduh dependency pertama kali:

```bash
bun install
cp .env.example .env.local
bun run dev
```

Buka `http://localhost:3000`. Jalankan pemeriksaan tipe, production build, dan integration smoke test:

```bash
bun run typecheck
bun run build
bun run test:smoke
```

Smoke test menjalankan build standalone pada port dan database sementara, lalu menguji proteksi direktori pekerja, login admin/pekerja, pemulihan sesi pekerja, pembuatan akun, reset PIN, akun nonaktif, QR valid, check-in, anti-duplikasi, dan QR invalid.

## Batasan MVP

Belum ada pengaturan shift, ekspor laporan, penghapusan permanen akun, atau integrasi Google Sheets bawaan; cloud sync hanya memakai kontrak webhook generik di atas. Akses admin masih satu PIN bersama, belum akun admin/staf terpisah atau role-permission granular. Data demo/PIN awal hanya untuk uji coba. Untuk penerapan lapangan, ganti secret dan PIN, batasi jaringan admin, sediakan backup volume, serta pasang HTTPS/sertifikat tepercaya untuk kamera ponsel.
