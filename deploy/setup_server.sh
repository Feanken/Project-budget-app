#!/usr/bin/env bash
# ==============================================================================
# SmartBudget - Ubuntu Server Automated Provisioning Script
# Target Specs: 1 vCPU, 1 GiB RAM, Ubuntu Linux
# Domain: livingsacrifice.my.id
# ==============================================================================

set -e

if ! sudo test -f /etc/budgetapp/budgetapp.env; then
    echo 'Buat /etc/budgetapp/budgetapp.env sesuai deploy/README.md sebelum menjalankan skrip ini.' >&2
    exit 1
fi

echo "=========================================================="
echo "🚀 Memulai Setup Server SmartBudget di Ubuntu..."
echo "=========================================================="

# 1. Update OS & Install Paket Dasar
echo "📦 [1/6] Memperbarui sistem dan menginstal paket penting..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx python3 python3-pip python3-venv git certbot python3-certbot-nginx curl ufw

# 2. Buat Swap File 2GB untuk Stabilitas RAM 1GB
if [ ! -f /swapfile ]; then
    echo "💾 [2/6] Membuat Swap File 2GB (Sangat krusial untuk RAM 1GB)..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "vm.swappiness=20" | sudo tee -a /etc/sysctl.conf
    sudo sysctl -p
    echo "✅ Swap 2GB berhasil diaktifkan!"
else
    echo "ℹ️ Swap file sudah ada, melanjutkan..."
fi

# 3. Setup Direktori Proyek & Virtualenv
APP_DIR="/var/www/budget-app"
echo "📂 [3/6] Menyiapkan direktori aplikasi di $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Pastikan venv dibuat
if [ ! -d "$APP_DIR/venv" ]; then
    python3 -m venv $APP_DIR/venv
fi

# Salin dependensi & install
if [ -f "$APP_DIR/requirements.txt" ]; then
    echo "🐍 Menginstal dependensi Python ke venv..."
    $APP_DIR/venv/bin/pip install --upgrade pip
    $APP_DIR/venv/bin/pip install -r $APP_DIR/requirements.txt
fi

# Inisialisasi Database SQLite WAL
if [ -f "$APP_DIR/database.py" ]; then
    echo "🗄️ Menginisialisasi Database SQLite WAL..."
    $APP_DIR/venv/bin/python $APP_DIR/database.py
fi

# 4. Konfigurasi Systemd Service
echo "⚙️ [4/6] Mengonfigurasi Systemd Service (Gunicorn)..."
if [ -f "$APP_DIR/deploy/budgetapp.service" ]; then
    sudo cp $APP_DIR/deploy/budgetapp.service /etc/systemd/system/budgetapp.service
    # Ganti username jika bukan 'ubuntu'
    sudo sed -i "s/User=ubuntu/User=$USER/g" /etc/systemd/system/budgetapp.service
    sudo systemctl daemon-reload
    sudo systemctl enable budgetapp
    sudo systemctl restart budgetapp
    echo "✅ Service budgetapp berjalan di background!"
fi

# 5. Konfigurasi Nginx Reverse Proxy
echo "🌐 [5/6] Mengonfigurasi Nginx Reverse Proxy untuk livingsacrifice.my.id..."
if [ -f "$APP_DIR/deploy/nginx.conf" ]; then
    sudo cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/budgetapp
    sudo ln -sf /etc/nginx/sites-available/budgetapp /etc/nginx/sites-enabled/
    # Hapus default nginx site jika masih aktif
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl reload nginx
    echo "✅ Nginx berhasil dikonfigurasi & di-reload!"
fi

# 6. Petunjuk Certbot SSL
echo "=========================================================="
echo "🎉 SETUP SELESAI!"
echo "Aplikasi Anda sekarang berjalan melalui Nginx di port 80."
echo ""
echo "Langkah Terakhir untuk HTTPS (SSL Certbot):"
echo "Pastikan DNS 'livingsacrifice.my.id' sudah diarahkan ke IP Public VM ini."
echo "Lalu jalankan perintah berikut di terminal Anda:"
echo ""
echo "   sudo certbot --nginx -d livingsacrifice.my.id -d www.livingsacrifice.my.id"
echo "=========================================================="
