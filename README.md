# SmartBudget & Cash Flow Ledger

SmartBudget adalah aplikasi pencatatan keuangan pribadi untuk mencatat pemasukan, pengeluaran, dan alokasi tabungan. Antarmukanya menggunakan HTML, CSS, dan JavaScript; mode server menggunakan Flask dan SQLite.

## Fitur

- Registrasi dan login pengguna, dengan kategori, rekening, transaksi, dan target tabungan per pengguna pada server.
- Pencatatan, pengubahan, penghapusan, pencarian, dan penyaringan transaksi.
- Target tabungan, setoran ke target, ringkasan saldo, dan visualisasi keuangan.
- Kalender transaksi dan pengelolaan kategori serta metode pembayaran.
- Ekspor dan impor transaksi dalam format CSV.

## Menjalankan secara lokal

### Mode Flask dan SQLite

Persyaratan: Python 3, pip, dan browser modern. Dari folder proyek di PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:SECRET_KEY = python -c "import secrets; print(secrets.token_hex(32))"
python app.py
```

Buka `http://127.0.0.1:5000`. Database `smartbudget.db` dibuat di folder proyek saat aplikasi dimulai. Akun baru dapat dibuat melalui halaman registrasi. Perintah `python app.py` menjalankan server pengembangan Flask tanpa debug dan hanya menerima koneksi lokal; jangan gunakan untuk produksi.

Di Windows, bila aktivasi virtual environment diblokir, Python di dalamnya juga dapat dipanggil langsung melalui `.\.venv\Scripts\python.exe`. Gunicorn ditujukan untuk deployment Linux; konfigurasi yang disertakan ada di folder `deploy/`.

### Mode pratinjau browser

Buka `index.html` langsung di browser. Mode ini menggunakan `localStorage` browser untuk akun dan data, terpisah dari SQLite pada mode Flask. Akun lokal disimpan di browser dan mode ini hanya cocok untuk demonstrasi; jangan gunakan untuk data sensitif. Membersihkan data browser dapat menghapus data lokal. Chart.js dimuat dari CDN dan memerlukan koneksi internet.

## Penyimpanan dan batasan saat ini

Pada mode server, data utama disimpan di SQLite dan juga dicache di `localStorage`. Saldo dihitung dari total pemasukan dikurangi pengeluaran dan alokasi tabungan, bukan saldo terpisah untuk setiap rekening. Ekspor CSV berisi transaksi; ekspor tersebut bukan cadangan lengkap pengguna, kategori, rekening, dan target.

Dalam mode server, perubahan menunggu respons server dan data dimuat ulang setelah penyimpanan. Jika koneksi terputus saat menyimpan, periksa data setelah memuat ulang sebelum mencoba lagi. Impor CSV dilakukan secara keseluruhan: bila satu baris gagal validasi atau menyebabkan saldo negatif, tidak ada baris yang diimpor. Impor transaksi tabungan mencatat riwayat tanpa menghubungkannya ke target. Setoran target yang terhubung hanya dapat dihapus, bukan diedit; penghapusan target mempertahankan riwayat transaksi dan tidak otomatis mengembalikan saldo.

Pembaruan ini tidak memperbaiki otomatis transaksi yang sebelumnya tercatat ganda atau data yang sudah tidak konsisten. Cadangkan database dan tinjau data lama sebelum menerapkannya. Nilai nominal masih disimpan sebagai angka pecahan SQLite (`REAL`); migrasi ke bilangan bulat perlu direncanakan dan diuji tersendiri.

Untuk produksi, `SECRET_KEY` wajib disediakan melalui environment dan minimal 32 karakter. Buat kunci acak yang kuat pada server dan rahasiakan. Terapkan HTTPS, `SESSION_COOKIE_SECURE=true`, dan pembatasan login di Nginx sesuai [panduan VM](deploy/README.md); konfigurasi pada server tidak berubah otomatis saat kode diperbarui. Backup SQLite dan hak akses file juga perlu disiapkan.

## Struktur proyek

```text
budget-app/
├── app.py                  # Rute Flask dan REST API
├── database.py             # Skema dan koneksi SQLite
├── requirements.txt        # Dependensi Python
├── index.html              # Pratinjau lokal
├── templates/dashboard.html
├── static/css/style.css
├── static/js/              # Model, layanan, dan antarmuka
└── deploy/                 # Contoh konfigurasi server Linux
```

API mencakup `/api/auth/*`, `/api/categories`, `/api/accounts`, `/api/goals`, `/api/transactions`, `/api/user/reset`, dan `/api/health`. Endpoint data membutuhkan sesi login dan membatasi data berdasarkan akun. Tes isolasi menggunakan dua akun dapat dijalankan dengan `python -m unittest discover -s tests -v` setelah dependensi dipasang; tes memakai database sementara, bukan database aplikasi. Health endpoint mengembalikan status statis, sehingga bukan pemeriksaan menyeluruh atas kondisi database.

## Prioritas pengembangan

1. Tinjau dan rekonsiliasi data lama yang mungkin sudah tidak konsisten; siapkan backup dan uji pemulihan.
2. Tuntaskan HTTPS, cookie aman, pembatasan login dan pengujian di VM.
3. Migrasikan nominal ke representasi rupiah bilangan bulat dan perluas validasi serta pengujian di browser.
