# Setup Online Procurement

## 1. Buat Database Online

1. Buka Supabase dan buat project baru.
2. Buka menu `SQL Editor`.
3. Jalankan isi file `supabase-schema.sql`.
4. Buka `Project Settings > API`.
5. Salin `Project URL` dan `anon public key`.
6. Isi file `cloud-config.js`.
7. Buka `Authentication > Users`, lalu buat user administrator dan user biasa.

Contoh:

```js
window.PROCUREMENT_CLOUD_CONFIG = {
  supabaseUrl: 'https://project-anda.supabase.co',
  anonKey: 'anon-key-anda',
  recordId: 'procurement-hrdga-ppp',
  authRequired: true,
  adminEmails: ['admin@perusahaan.co.id']
};
```

Jika `adminEmails` dikosongkan (`[]`), tidak ada akun yang dianggap administrator. Isi daftar ini dengan email admin yang boleh melihat semua transaksi.

Untuk sistem multi-user, isi `adminEmails` hanya dengan email administrator. Email lain yang dibuat di Supabase Auth tetap bisa login sebagai user biasa, tetapi hanya melihat transaksi yang dibuat oleh email tersebut.

## 2. Upload Aplikasi

Upload semua file di folder `procurement-system` ke hosting statis, misalnya Netlify, Vercel, GitHub Pages, atau hosting perusahaan.

File yang perlu ikut:

- `index.html`
- `styles.css`
- `script.js`
- `cloud-config.js`
- `cloud-store.js`
- `assets/logo-puri.jpg`

Jika memakai folder `publish`, upload seluruh isi folder tersebut.

## 3. Cara Kerja

Jika `cloud-config.js` terisi dan `authRequired` bernilai `true`, aplikasi akan menampilkan halaman login. Setelah login berhasil, aplikasi mengambil dan menyimpan data ke Supabase. Jika konfigurasi cloud kosong, aplikasi otomatis memakai penyimpanan lokal browser seperti sebelumnya.

Nomor transaksi tetap memakai sequence bersama di database online, sehingga nomor akan terus berlanjut walaupun dibuat oleh user yang berbeda.

Gunakan `Backup Data` sebelum migrasi pertama, lalu `Restore Data` setelah cloud aktif agar data lama ikut tersimpan online.
