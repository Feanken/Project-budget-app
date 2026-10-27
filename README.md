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

**Penting:** sinkronisasi saat ini belum dapat diandalkan. Kegagalan permintaan server tidak selalu ditampilkan, ID objek baru di browser tidak langsung diganti dengan ID server, dan setoran target dapat tercatat ganda. Perubahan lokal atau hasil impor dapat berbeda dari data setelah halaman dimuat ulang. Perlindungan saldo juga belum mencakup semua operasi. Periksa dan perbaiki masalah ini sebelum mengandalkan aplikasi untuk pencatatan keuangan nyata.

Untuk produksi, `SECRET_KEY` wajib disediakan melalui environment dan minimal 32 karakter. Buat kunci acak yang kuat pada server dan rahasiakan. Konfigurasi deployment perlu ditinjau, termasuk HTTPS, cookie aman, perlindungan CSRF, pembatasan percobaan login, backup SQLite, dan hak akses file. Panduan yang ada di [deploy/README.md](deploy/README.md) menjelaskan langkah VM dan perlu disesuaikan dengan lingkungan Anda.

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

API mencakup `/api/auth/*`, `/api/categories`, `/api/accounts`, `/api/goals`, `/api/transactions`, `/api/user/reset`, dan `/api/health`. Endpoint data membutuhkan sesi login. Health endpoint mengembalikan status statis, sehingga bukan pemeriksaan menyeluruh atas kondisi database.

## Prioritas pengembangan

1. Jadikan respons server sumber data utama, tangani kegagalan, gunakan ID dari server, dan pastikan setoran hanya dicatat sekali.
2. Jaga konsistensi saldo dan target saat transaksi diubah atau dihapus; validasi seluruh input di server dan gunakan operasi database atomik.
3. Perkuat keamanan autentikasi, sesi, dan deployment; tambahkan pengujian otomatis untuk alur keuangan dan isolasi pengguna.
4. Perbaiki impor CSV dan sediakan backup serta pemulihan data lengkap sebelum menambah fitur baru.
