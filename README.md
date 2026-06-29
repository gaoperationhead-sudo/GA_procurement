# Sistem Procurement HRDGA PPP

Sistem lokal untuk mencatat dan mencetak:

- Purchase Order
- Surat Perintah Kerja
- Cash Advance Request
- Payment Request
- Cash Advance Completion

## Cara buka

Buka file `index.html` di browser.

Jika browser membatasi file lokal, jalankan server lokal dari folder ini dengan Python atau alat server lokal lain, lalu buka alamat yang muncul di browser.

## Alur

- Purchase Order: isi rincian item dan harga, simpan, lalu Payment Request bisa dibuat otomatis.
- Cash Advance: buat Cash Advance Request, Payment Request bisa dibuat otomatis, lalu buat Cash Advance Completion dari referensi CAR/PR.
- Payment Request: bisa dibuat manual dari referensi PO, CAR, atau SPK.

## Nomor register

Nomor dibuat otomatis saat data disimpan dengan format:

`000001/HRDGA-PPP/PO/VI/2026`

Kode departemen memakai 5 huruf: `HRDGA`, `OPNET`, `LEGAL`, atau `FINAC`. Urutan dipisah per jenis formulir, departemen, dan tahun.

## Cetak atau PDF

Klik `Preview` untuk melihat hasil formulir, atau klik `Print / PDF` lalu pilih printer atau `Save as PDF`.

## Referensi

PO, CAR, atau SPK yang sudah ditarik ke Payment Request tidak muncul lagi di referensi Payment Request berikutnya. Cash Advance Completion hanya menampilkan Payment Request dari CAR tipe `Uang Muka`.

## Vendor & Payee

Daftarkan vendor atau penerima pembayaran di menu `Vendor & Payee`. Data yang disimpan meliputi nama, telepon, alamat, rekening, bank, dan NPWP.

Di PO dan PR, klik tombol `...` pada field Vendor atau Payee untuk memilih data yang sudah didaftarkan. Saat Payee dipilih di PR, nama bank dan nomor rekening otomatis terisi.

## Filter bulan

Dashboard dan Record dapat difilter berdasarkan bulan transaksi dari tanggal formulir.

Menu Record juga dapat difilter berdasarkan departemen pengaju. Preview/print dokumen dibuka dari menu Record agar layar input tetap bersih.

## Login User dan Administrator

Jika `cloud-config.js` mengaktifkan `authRequired`, aplikasi menampilkan halaman login sebelum dashboard. User dibuat dari Supabase `Authentication > Users`.

Email yang masuk ke `adminEmails` menjadi administrator dan dapat melihat semua transaksi. Email lain menjadi user biasa dan hanya melihat transaksi yang dibuat sendiri. Nomor transaksi tetap berlanjut bersama lintas user.

## Penyimpanan data

Data tersimpan di browser yang dipakai. Gunakan `Backup Data` secara berkala agar record dapat dipindahkan atau direstore.
