# SmartBudget & Cash Flow Ledger 💸

**Catat cash flow, pantau pengeluaran, dan kejar target tabungan dalam satu aplikasi.**

SmartBudget adalah aplikasi web untuk mengelola keuangan pribadi. User bisa mencatat pemasukan dan pengeluaran, melihat saldo dan riwayat transaksi, lalu menyisihkan dana untuk goal—misalnya liburan atau dana darurat. Setiap akun punya data keuangan sendiri.

Proyek ini menggunakan frontend HTML, CSS, dan JavaScript, backend Flask, serta SQLite sebagai database. Bisa dijalankan di komputer lokal atau di VM Linux dengan Gunicorn dan Nginx.

## Yang bisa dilakukan ✨

- **Akun:** registrasi, login, logout, dan data yang dipisahkan per pengguna.
- **Transaksi:** catat, ubah, hapus, cari, dan filter pemasukan atau pengeluaran.
- **Goal:** buat target tabungan dan alokasikan saldo ke target tersebut.
- **Dashboard dan kalender:** lihat ringkasan cash flow dan aktivitas berdasarkan tanggal.
- **Kategori dan rekening:** atur kategori transaksi serta label metode pembayaran.
- **CSV:** ekspor dan impor riwayat transaksi.

## Tech stack 🧰

| Bagian | Teknologi |
| --- | --- |
| Frontend | HTML, CSS, JavaScript dan Chart.js melalui CDN |
| Backend | Python dan Flask |
| Database | SQLite dengan mode WAL |
| Deployment contoh | Gunicorn, Nginx, dan systemd di Linux |
| Testing | Python `unittest` dan Node.js untuk tes JavaScript |

## Quick start 🚀

Butuh **Python 3**, pip, dan browser modern. Dari root proyek, buat virtual environment dan install dependensi.

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:SECRET_KEY = python -c "import secrets; print(secrets.token_hex(32))"
python app.py
```

**Linux / macOS:**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python app.py
```

Buka **http://127.0.0.1:5000**, lalu buat akun lewat halaman registrasi. Database `smartbudget.db` dibuat di root proyek saat pertama kali aplikasi dijalankan jika tidak ada path database khusus.

Kunci pada contoh dibuat untuk sesi terminal saat ini. Jika diganti, sesi login lama tidak berlaku lagi. Untuk penggunaan yang persisten, simpan kunci secara aman di konfigurasi environment dan jangan commit ke Git. Perintah `python app.py` menjalankan server pengembangan tanpa debug pada localhost; untuk produksi, gunakan WSGI server seperti Gunicorn.

> Di Windows, jika aktivasi virtual environment terhalang, gunakan `.\.venv\Scripts\python.exe` langsung untuk menjalankan perintah Python.

### Mau lihat demo tanpa server?

Buka `index.html` langsung di browser. Mode ini memakai `localStorage` untuk akun dan data, terpisah dari SQLite. Akun demo disimpan di browser dan kata sandinya hanya dikodekan dengan Base64; gunakan mode ini untuk demo, bukan data sensitif. Menghapus data browser juga dapat menghapus data demo. Chart.js membutuhkan koneksi internet.

## Konfigurasi ⚙️

| Environment variable | Fungsi |
| --- | --- |
| `SECRET_KEY` | **Wajib.** Kunci untuk menandatangani sesi Flask; minimal 32 karakter. Gunakan nilai acak yang kuat. |
| `SESSION_COOKIE_SECURE` | Set `true` setelah HTTPS aktif agar cookie sesi hanya dikirim melalui HTTPS. Default `false` untuk pengujian lokal. |
| `SMARTBUDGET_DB_PATH` | Opsional. Path ke database SQLite yang **sudah ada**. Jika tidak diatur, aplikasi memakai `smartbudget.db` di root proyek. |
| `PORT` | Port untuk `python app.py`; default `5000`. |

Jika `SMARTBUDGET_DB_PATH` diatur tetapi file tidak ditemukan, aplikasi gagal mulai agar tidak diam-diam membuat database kosong di lokasi yang salah.

## Cara kerja singkat 🧠

```text
Browser → Flask API → SQLite
             ↑
       Gunicorn / Nginx (deployment VM)
```

Pada mode server, browser mengirim perubahan ke API dan menunggu respons sebelum memuat data terbaru. Server memeriksa sesi, kepemilikan data, dan validasi transaksi. Data juga dicache di `localStorage` untuk tampilan.

Saldo dihitung dari **pemasukan − pengeluaran − alokasi tabungan**. Rekening atau metode pembayaran saat ini adalah label transaksi; saldo belum dihitung terpisah per rekening.

## API ringkas 🔌

| Endpoint | Kegunaan |
| --- | --- |
| `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | Registrasi dan sesi pengguna. |
| `/api/categories` dan `/api/accounts` | Daftar dan tambah kategori atau rekening; hapus melalui endpoint dengan nama. |
| `/api/goals` | Daftar dan buat goal; tersedia endpoint hapus dan setoran berdasarkan ID. |
| `/api/transactions` | Daftar dan buat transaksi; tersedia endpoint ubah dan hapus berdasarkan ID. |
| `/api/transactions/import` | Impor transaksi CSV. |
| `/api/user/reset` | Hapus transaksi dan goal milik pengguna yang login. |
| `/api/health` | Mengembalikan status statis aplikasi, bukan pemeriksaan database menyeluruh. |

Endpoint data memerlukan sesi login. Permintaan API yang mengubah data harus menyertakan `X-Requested-With: XMLHttpRequest`; frontend menambahkannya otomatis. Perlindungan ini bergantung pada kebijakan same-origin dan konfigurasi CORS yang tepat.

## Menjalankan tes 🧪

Setelah dependensi Python terpasang, jalankan dari root proyek:

```bash
python -m unittest discover -s tests -v
```

Tes memakai database sementara dan mencakup isolasi pengguna, sesi, transaksi, impor CSV, backup, serta audit data. Untuk tes sinkronisasi JavaScript, install Node.js lalu jalankan:

```bash
node tests/test_sync.js
```

## Backup dan audit database 🗄️

Backup menggunakan SQLite Online Backup API, jadi data yang masih berada di WAL ikut disalin. Skrip menolak menimpa file tujuan yang sudah ada dan memeriksa integritas hasil backup.

```bash
python backup_database.py --source smartbudget.db --output smartbudget-backup.db
python audit_database.py --database smartbudget-backup.db
```

`audit_database.py` hanya membaca data dan menandai hal yang perlu ditinjau, seperti saldo negatif, ketidaksesuaian goal, nominal pecahan, atau kemungkinan duplikat. Duplikat dan setoran tanpa goal belum tentu salah—jangan langsung hapus berdasarkan laporan. Hasil audit bisa berisi saldo dan ID pengguna, jadi perlakukan sebagai data pribadi.

Backup di mesin yang sama belum melindungi dari kehilangan mesin. Simpan salinan terenkripsi di lokasi terpisah dan uji pemulihannya. Contoh timer backup harian serta langkah pemulihan tersedia di [panduan deployment](deploy/README.md).

## Deployment ke VM ☁️

Folder `deploy/` berisi contoh konfigurasi Gunicorn, Nginx, systemd, dan backup untuk VM Linux. Ikuti [panduan deployment](deploy/README.md) dan sesuaikan pengguna service, domain, lokasi proyek, serta database dengan VM yang digunakan.

Sebelum aplikasi dipakai untuk data nyata, pastikan HTTPS, cookie `Secure`, pembatasan login pada Nginx, izin file, serta backup sudah dikonfigurasi dan diuji pada server. Mengubah file di repo tidak otomatis mengubah konfigurasi server yang sedang aktif.

## Struktur proyek 📁

```text
budget-app/
├── app.py                    # Flask routes dan API
├── database.py               # Koneksi dan skema SQLite
├── backup_database.py        # Backup database
├── audit_database.py         # Audit data tanpa mengubah database
├── index.html                # Demo lokal berbasis browser
├── requirements.txt          # Dependensi Python
├── templates/dashboard.html  # Halaman Flask
├── static/                   # CSS, model, services, dan UI JavaScript
├── tests/                    # Tes Python dan JavaScript
└── deploy/                   # Contoh konfigurasi dan panduan VM
```

## Hal yang perlu diketahui 📌

- Jika koneksi terputus saat menyimpan, muat ulang dan periksa data sebelum mencoba lagi; server mungkin sudah memproses permintaan.
- Impor CSV pada mode server bersifat menyeluruh: jika ada baris tidak valid atau membuat saldo negatif, seluruh impor dibatalkan. Ekspor CSV berisi transaksi, bukan backup lengkap akun dan goal.
- Setoran yang terkait dengan goal bisa dihapus, tetapi belum bisa diedit. Menghapus goal mempertahankan riwayat transaksi dan tidak otomatis mengembalikan saldo.
- Perbaikan sinkronisasi tidak otomatis membersihkan data lama yang sudah ganda atau tidak konsisten. Audit salinan backup dan tinjau hasilnya terlebih dahulu.
- Nominal masih disimpan sebagai SQLite `REAL`. Migrasi ke bilangan bulat rupiah serta pengujian browser yang lebih luas masih menjadi pekerjaan lanjutan.
- Sesi Flask berbasis cookie belum memiliki pencabutan per sesi di server; salinan cookie yang masih berlaku tidak otomatis dicabut hanya dengan logout di browser.
