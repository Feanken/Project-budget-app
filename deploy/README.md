# Menjalankan SmartBudget di VM Ubuntu

Panduan ini menyiapkan Gunicorn di `127.0.0.1:8000` di belakang Nginx. Contoh memakai folder `/var/www/budget-app`, pengguna Linux `ubuntu`, dan domain dalam `nginx.conf`; sesuaikan dengan VM Anda. Jangan menjalankan `python app.py` sebagai server publik: perintah itu hanya server pengembangan dan sekarang mendengarkan `127.0.0.1`.

## 1. Pindahkan kode dan lindungi data

Cadangkan database VM terlebih dahulu dengan metode backup SQLite yang konsisten. Jangan menimpa atau menghapus `smartbudget.db`, file `smartbudget.db-wal`/`smartbudget.db-shm` yang aktif, atau virtual environment ketika memindahkan kode. Salin file aplikasi yang diperbarui (`app.py`, `database.py`, `requirements.txt`, `templates/`, `static/`, dan `deploy/`) ke direktori aplikasi yang ada. Jangan menyalin database dari komputer lokal ke VM jika database VM berisi data yang ingin dipertahankan.

Pastikan folder aplikasi dan database dapat dibaca/ditulis oleh pengguna service, dan pengguna lain tidak memiliki akses yang tidak diperlukan. Jangan letakkan backup atau rahasia dalam `static/`, karena aset dalam folder itu dapat diunduh pengunjung. HTML, CSS, dan JavaScript yang dikirim ke browser dapat dilihat pengunjung.

## 2. Buat kunci rahasia di VM

Lakukan sekali pada VM. Perintah berikut tidak menimpa file rahasia yang sudah ada:

```bash
sudo install -d -m 700 /etc/budgetapp
if sudo test -e /etc/budgetapp/budgetapp.env; then
  echo 'File rahasia sudah ada; pertahankan kunci yang sekarang.'
else
  sudo sh -c 'umask 077; printf "SECRET_KEY=%s\n" "$(python3 -c "import secrets; print(secrets.token_hex(32))")" > /etc/budgetapp/budgetapp.env'
fi
```

File tersebut dibaca oleh systemd saat service dimulai. Jangan bagikan, salin ke folder publik, atau masukkan ke Git. Gunakan kunci yang sama setiap restart; mengganti kunci akan membuat semua sesi lama tidak berlaku. Jika VM sebelumnya memakai kunci bawaan pada kode lama, membuat kunci baru juga akan meminta semua pengguna login kembali.

## 3. Siapkan service

Pastikan Python, virtual environment, Gunicorn, dan Nginx sudah terpasang. Misalnya, jika virtual environment belum ada:

```bash
cd /var/www/budget-app
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

Periksa `deploy/budgetapp.service`: `User=ubuntu`, `WorkingDirectory`, dan lokasi `venv` harus sesuai VM. Service perlu izin menulis folder database agar SQLite dapat membuat file WAL. Salin dan aktifkan konfigurasi:

```bash
sudo cp deploy/budgetapp.service /etc/systemd/system/budgetapp.service
sudo systemctl daemon-reload
sudo systemctl enable --now budgetapp
sudo systemctl restart budgetapp
sudo systemctl status budgetapp
curl http://127.0.0.1:8000/api/health
```

Jika service gagal, periksa `sudo journalctl -u budgetapp -n 50 --no-pager`. Kunci yang tidak tersedia atau kurang dari 32 karakter membuat aplikasi gagal mulai. Jangan tampilkan nilai kunci dalam laporan atau log.

## 4. Periksa Nginx dan akses publik

`deploy/nginx.conf` adalah contoh untuk domain dan lokasi di atas. Sesuaikan `server_name` serta jalur static, lalu uji konfigurasi dengan `sudo nginx -t` sebelum mengaktifkan atau memuat ulang Nginx. Jangan menyajikan seluruh direktori proyek sebagai direktori file publik. Pastikan port Gunicorn tidak dibuka langsung ke internet dan periksa bahwa URL seperti `/app.py`, `/database.py`, `/smartbudget.db`, dan `/.env` tidak mengembalikan isi file.

Contoh konfigurasi ini hanya menyediakan HTTP. **Sebelum digunakan untuk akun atau data nyata**, pasang HTTPS, arahkan HTTP ke HTTPS, dan lanjutkan tahap keamanan sesi, CSRF, dan pembatasan login. Tahap ini belum memperbaiki masalah sinkronisasi dan konsistensi saldo yang dijelaskan di README utama.

## 5. Penerapan keamanan sesi dan login

Periksa konfigurasi yang sedang aktif terlebih dahulu dengan `sudo nginx -T`; jangan menimpa konfigurasi HTTPS atau sertifikat yang sudah ada dengan contoh HTTP di repositori. Pastikan domain Anda benar dan HTTPS aktif, misalnya dengan `curl -I https://DOMAIN-ANDA/`. Jika belum, pasang sertifikat dan pengalihan HTTP ke HTTPS dengan konfigurasi yang sesuai VM, misalnya Certbot untuk Nginx. Gunicorn tetap hanya pada localhost dan port 8000 tidak boleh dapat diakses publik. Jika ada reverse proxy/CDN lain di depan Nginx, pastikan alamat IP pengguna ditentukan dengan benar melalui proxy tepercaya sebelum menerapkan pembatasan.

Setelah HTTPS bekerja, tambahkan baris `SESSION_COOKIE_SECURE=true` ke `/etc/budgetapp/budgetapp.env` tanpa mengganti `SECRET_KEY`, lalu restart `budgetapp`. Dengan cookie Secure, login tidak akan bekerja melalui HTTP. Untuk pengujian lokal HTTP saja, nilai default adalah `false`. Sesi login berlaku maksimal delapan jam; akun yang sudah ada tetap dapat memakai kata sandi lama, sedangkan pendaftaran baru memerlukan 12–128 karakter.

Aktifkan pembatasan di konfigurasi Nginx aktif: di dalam blok `http` tambahkan `limit_req_zone $binary_remote_addr zone=budget_auth:10m rate=5r/m;` satu kali. Pada blok `server` HTTPS untuk aplikasi, tambahkan lokasi login dan registrasi seperti pada `deploy/nginx.conf` (termasuk `proxy_pass` dan header proxy yang sesuai VM). Jika HTTP masih meneruskan API, lindungi juga blok itu atau alihkan seluruh HTTP ke HTTPS. Pengaturan ini membatasi berdasarkan IP dan dapat membatasi beberapa pengguna yang berbagi jaringan. Jalankan `sudo nginx -t` sebelum `sudo systemctl reload nginx` dan periksa login setelah reload. Jika ada proxy lain di depan Nginx, pembatasan tanpa konfigurasi IP yang benar dapat berlaku untuk semua pengguna sekaligus.

Permintaan API yang mengubah data wajib menyertakan header `X-Requested-With: XMLHttpRequest`; halaman aplikasi menyertakannya otomatis. Perlindungan ini bergantung pada kebijakan same-origin browser dan tidak mengizinkan CORS lintas origin; jangan mengaktifkan CORS sembarangan. Klien API eksternal harus menyertakan header tersebut. Logout menghapus cookie browser, tetapi sesi Flask berbasis cookie yang sudah disalin tidak bisa dicabut satu per satu dan tetap berlaku sampai kedaluwarsa; pencabutan sesi di server adalah pengembangan berikutnya.

`setup_server.sh` adalah skrip provisioning lama yang mengubah konfigurasi sistem, swap, dan Nginx; baca serta sesuaikan isinya sebelum menjalankannya. Panduan manual di atas lebih sesuai untuk memperbarui VM yang sudah ada.
