"""
SmartBudget Web Application - Flask Backend Entry Point with SQLite Integration
Designed for high efficiency on 1 vCPU & 1 GiB RAM Ubuntu Server.
"""

import os
import functools
from datetime import timedelta
from flask import Flask, render_template, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, close_db, init_db, seed_default_user_options

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)

# Configuration
secret_key = os.environ.get("SECRET_KEY", "")
if len(secret_key) < 32:
    raise RuntimeError("SECRET_KEY harus diatur melalui environment dan memiliki minimal 32 karakter.")
app.config["SECRET_KEY"] = secret_key
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=8)
app.config["SESSION_REFRESH_EACH_REQUEST"] = False

@app.before_request
def require_api_request_header():
    # Custom headers require a same-origin request or an authorized CORS preflight.
    if request.path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        if request.headers.get("X-Requested-With") != "XMLHttpRequest":
            return jsonify({"error": "Permintaan ditolak."}), 403

@app.after_request
def security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response

# Register database teardown callback
app.teardown_appcontext(close_db)

# Ensure database tables exist on launch
with app.app_context():
    init_db()


# ============================================================================
# AUTHENTICATION HELPERS & DECORATORS
# ============================================================================

def login_required(view):
    """Decorator to protect API routes requiring user authentication."""
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Sesi tidak ditemukan atau kedaluwarsa. Silakan login kembali."}), 401
        return view(**kwargs)
    return wrapped_view


def get_current_user_id():
    return session.get("user_id")


def calculate_user_net_balance(db, user_id):
    """Calculate current available net balance directly via SQLite aggregation."""
    row = db.execute("""
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN type IN ('expense', 'goal_saving') THEN amount ELSE 0 END), 0) AS total_expense
        FROM transactions
        WHERE user_id = ?;
    """, (user_id,)).fetchone()
    return float(row["total_income"] - row["total_expense"])


# ============================================================================
# PAGE ROUTES
# ============================================================================

@app.route("/")
def dashboard():
    """Render main application template."""
    return render_template("dashboard.html")


@app.route("/api/health")
def health_check():
    """Health check endpoint for Nginx and systemd monitoring."""
    return jsonify({
        "status": "healthy",
        "service": "SmartBudget App",
        "phase": "Phase 3 (SQLite & REST API Integrated)",
        "database": "SQLite WAL"
    }), 200


# ============================================================================
# AUTH REST API ENDPOINTS
# ============================================================================

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not username or len(username) < 3:
        return jsonify({"error": "ID Pengguna minimal terdiri dari 3 karakter."}), 400
    if len(password) < 12 or len(password) > 128:
        return jsonify({"error": "Kata sandi harus terdiri dari 12 sampai 128 karakter."}), 400
    if password != confirm_password:
        return jsonify({"error": "Konfirmasi kata sandi tidak cocok."}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE username = ?;", (username,)).fetchone()
    if existing:
        return jsonify({"error": f"ID Pengguna '{username}' sudah terdaftar. Silakan login."}), 409

    hashed_pw = generate_password_hash(password)
    cursor = db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?);",
        (username, hashed_pw)
    )
    user_id = cursor.lastrowid
    db.commit()

    # Seed default categories & accounts for this user
    seed_default_user_options(db, user_id)

    # Establish session
    session.clear()
    session.permanent = True
    session["user_id"] = user_id
    session["username"] = username

    return jsonify({
        "message": "Registrasi berhasil!",
        "user": {"id": user_id, "username": username}
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    if not username or not password:
        return jsonify({"error": "ID Pengguna dan kata sandi wajib diisi."}), 400

    db = get_db()
    user = db.execute("SELECT id, username, password_hash FROM users WHERE username = ?;", (username,)).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "ID Pengguna atau kata sandi yang Anda masukkan salah."}), 401

    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    session["username"] = user["username"]

    return jsonify({
        "message": "Login berhasil!",
        "user": {"id": user["id"], "username": user["username"]}
    }), 200


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"message": "Berhasil logout."}), 200


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"user": None}), 200

    db = get_db()
    user = db.execute("SELECT id, username, created_at FROM users WHERE id = ?;", (user_id,)).fetchone()
    if not user:
        session.clear()
        return jsonify({"user": None}), 200

    return jsonify({
        "user": {
            "id": user["id"],
            "username": user["username"],
            "created_at": user["created_at"]
        }
    }), 200


# ============================================================================
# CATEGORIES & ACCOUNTS API
# ============================================================================

@app.route("/api/categories", methods=["GET", "POST"])
@login_required
def handle_categories():
    user_id = get_current_user_id()
    db = get_db()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = str(data.get("name", "")).strip()
        if not name:
            return jsonify({"error": "Nama kategori tidak boleh kosong."}), 400

        try:
            db.execute("INSERT INTO categories (user_id, name) VALUES (?, ?);", (user_id, name))
            db.commit()
            return jsonify({"message": f"Kategori '{name}' berhasil ditambahkan.", "name": name}), 201
        except Exception:
            return jsonify({"error": f"Kategori '{name}' sudah ada."}), 409

    rows = db.execute("SELECT id, name FROM categories WHERE user_id = ? ORDER BY id ASC;", (user_id,)).fetchall()
    return jsonify([row["name"] for row in rows]), 200


@app.route("/api/categories/<name>", methods=["DELETE"])
@login_required
def delete_category(name):
    user_id = get_current_user_id()
    db = get_db()
    
    count_row = db.execute("SELECT COUNT(*) as cnt FROM categories WHERE user_id = ?;", (user_id,)).fetchone()
    if count_row["cnt"] <= 1:
        return jsonify({"error": "Minimal harus ada 1 kategori dalam sistem."}), 400

    db.execute("DELETE FROM categories WHERE user_id = ? AND name = ? COLLATE NOCASE;", (user_id, name))
    db.commit()
    return jsonify({"message": f"Kategori '{name}' dihapus."}), 200


@app.route("/api/accounts", methods=["GET", "POST"])
@login_required
def handle_accounts():
    user_id = get_current_user_id()
    db = get_db()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = str(data.get("name", "")).strip()
        if not name:
            return jsonify({"error": "Nama rekening/metode pembayaran tidak boleh kosong."}), 400

        try:
            db.execute("INSERT INTO accounts (user_id, name) VALUES (?, ?);", (user_id, name))
            db.commit()
            return jsonify({"message": f"Rekening '{name}' berhasil ditambahkan.", "name": name}), 201
        except Exception:
            return jsonify({"error": f"Rekening '{name}' sudah ada."}), 409

    rows = db.execute("SELECT id, name FROM accounts WHERE user_id = ? ORDER BY id ASC;", (user_id,)).fetchall()
    return jsonify([row["name"] for row in rows]), 200


@app.route("/api/accounts/<name>", methods=["DELETE"])
@login_required
def delete_account(name):
    user_id = get_current_user_id()
    db = get_db()
    
    count_row = db.execute("SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ?;", (user_id,)).fetchone()
    if count_row["cnt"] <= 1:
        return jsonify({"error": "Minimal harus ada 1 rekening dalam sistem."}), 400

    db.execute("DELETE FROM accounts WHERE user_id = ? AND name = ? COLLATE NOCASE;", (user_id, name))
    db.commit()
    return jsonify({"message": f"Rekening '{name}' dihapus."}), 200


# ============================================================================
# GOALS API (WITH NEGATIVE TEST SERVER VALIDATION)
# ============================================================================

@app.route("/api/goals", methods=["GET", "POST"])
@login_required
def handle_goals():
    user_id = get_current_user_id()
    db = get_db()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        title = str(data.get("title", "")).strip()
        target_amount = float(data.get("target_amount") or 0)
        initial_amount = float(data.get("current_amount") or 0)
        category = str(data.get("category", "Tabungan"))
        deadline = data.get("deadline") or None

        if not title:
            return jsonify({"error": "Nama target goal tidak boleh kosong."}), 400
        if target_amount <= 0:
            return jsonify({"error": "Target nominal harus lebih besar dari 0."}), 400

        # SERVER-SIDE NEGATIVE TEST CHECK: Available balance for initial deposit
        if initial_amount > 0:
            net_balance = calculate_user_net_balance(db, user_id)
            if initial_amount > net_balance:
                return jsonify({
                    "error": f"Saldo tidak mencukupi untuk setoran awal! Saldo Anda: Rp {net_balance:,.0f}, sedangkan setoran awal: Rp {initial_amount:,.0f}."
                }), 400

        cursor = db.execute("""
            INSERT INTO goals (user_id, title, target_amount, current_amount, category, deadline)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (user_id, title, target_amount, initial_amount, category, deadline))
        goal_id = cursor.lastrowid

        # If initial amount provided, record allocation transaction
        if initial_amount > 0:
            account = str(data.get("account", "Tunai / Cash"))
            db.execute("""
                INSERT INTO transactions (user_id, type, title, amount, category, account, goal_id)
                VALUES (?, 'goal_saving', ?, ?, 'Goal Saving', ?, ?);
            """, (user_id, f"Setoran Awal: {title}", initial_amount, account, goal_id))

        db.commit()
        return jsonify({"message": "Goal berhasil disimpan!", "id": goal_id}), 201

    rows = db.execute("""
        SELECT id, title, target_amount, current_amount, category, deadline, created_at
        FROM goals
        WHERE user_id = ?
        ORDER BY id DESC;
    """, (user_id,)).fetchall()

    goals = []
    for r in rows:
        goals.append({
            "id": str(r["id"]),
            "title": r["title"],
            "targetAmount": r["target_amount"],
            "currentAmount": r["current_amount"],
            "category": r["category"],
            "deadline": r["deadline"],
            "createdAt": r["created_at"]
        })
    return jsonify(goals), 200


@app.route("/api/goals/<int:goal_id>/deposit", methods=["POST"])
@login_required
def deposit_to_goal(goal_id):
    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}
    amount = float(data.get("amount") or 0)
    account = str(data.get("account", "Tunai / Cash"))

    if amount <= 0:
        return jsonify({"error": "Nominal alokasi tabungan harus lebih dari 0."}), 400

    db = get_db()
    goal = db.execute("SELECT id, title, target_amount, current_amount FROM goals WHERE id = ? AND user_id = ?;", (goal_id, user_id)).fetchone()
    if not goal:
        return jsonify({"error": "Target goal tidak ditemukan."}), 404

    # SERVER-SIDE NEGATIVE TEST CHECK 1: Net Balance Check
    net_balance = calculate_user_net_balance(db, user_id)
    if amount > net_balance:
        return jsonify({
            "error": f"Saldo tidak mencukupi! Saldo Anda saat ini: Rp {net_balance:,.0f}, sedangkan alokasi tabungan: Rp {amount:,.0f}."
        }), 400

    # SERVER-SIDE NEGATIVE TEST CHECK 2: Exceeding Remaining Goal Check
    remaining = max(0.0, goal["target_amount"] - goal["current_amount"])
    if amount > remaining:
        return jsonify({
            "error": f"Nominal alokasi (Rp {amount:,.0f}) melebihi sisa kebutuhan target ini (Rp {remaining:,.0f})!"
        }), 400

    new_amount = goal["current_amount"] + amount
    db.execute("UPDATE goals SET current_amount = ? WHERE id = ?;", (new_amount, goal_id))
    db.execute("""
        INSERT INTO transactions (user_id, type, title, amount, category, account, goal_id)
        VALUES (?, 'goal_saving', ?, ?, 'Goal Saving', ?, ?);
    """, (user_id, f"Nabung: {goal['title']}", amount, account, goal_id))
    db.commit()

    return jsonify({
        "message": f"Berhasil menabung Rp {amount:,.0f} untuk '{goal['title']}'!",
        "currentAmount": new_amount
    }), 200


@app.route("/api/goals/<int:goal_id>", methods=["DELETE"])
@login_required
def delete_goal(goal_id):
    user_id = get_current_user_id()
    db = get_db()
    db.execute("DELETE FROM goals WHERE id = ? AND user_id = ?;", (goal_id, user_id))
    db.commit()
    return jsonify({"message": "Goal berhasil dihapus."}), 200


# ============================================================================
# TRANSACTIONS API (CRUD & ARUS KAS)
# ============================================================================

@app.route("/api/transactions", methods=["GET", "POST"])
@login_required
def handle_transactions():
    user_id = get_current_user_id()
    db = get_db()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        tx_type = str(data.get("type", "expense")).lower()
        title = str(data.get("title", "")).strip()
        amount = float(data.get("amount") or 0)
        category = str(data.get("category", "Umum"))
        account = str(data.get("account", "Tunai / Cash"))
        date = data.get("date")

        if not title or amount <= 0:
            return jsonify({"error": "Judul dan nominal transaksi harus valid."}), 400

        # SERVER-SIDE NEGATIVE TEST CHECK: Expense against net balance
        if tx_type == "expense":
            net_balance = calculate_user_net_balance(db, user_id)
            if amount > net_balance:
                return jsonify({
                    "error": f"Saldo tidak mencukupi! Saldo bersih saat ini: Rp {net_balance:,.0f}, sedangkan pengeluaran: Rp {amount:,.0f}."
                }), 400

        cursor = db.execute("""
            INSERT INTO transactions (user_id, type, title, amount, category, account, date)
            VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP));
        """, (user_id, tx_type, title, amount, category, account, date))
        db.commit()
        return jsonify({"message": "Transaksi berhasil disimpan!", "id": cursor.lastrowid}), 201

    rows = db.execute("""
        SELECT id, type, title, amount, category, account, goal_id, date
        FROM transactions
        WHERE user_id = ?
        ORDER BY date DESC, id DESC;
    """, (user_id,)).fetchall()

    tx_list = []
    for r in rows:
        tx_list.append({
            "id": str(r["id"]),
            "type": r["type"],
            "title": r["title"],
            "amount": r["amount"],
            "category": r["category"],
            "account": r["account"],
            "goalId": str(r["goal_id"]) if r["goal_id"] else None,
            "date": r["date"]
        })
    return jsonify(tx_list), 200


@app.route("/api/transactions/<int:tx_id>", methods=["PUT", "DELETE"])
@login_required
def modify_transaction(tx_id):
    user_id = get_current_user_id()
    db = get_db()

    existing = db.execute("SELECT id, type, amount FROM transactions WHERE id = ? AND user_id = ?;", (tx_id, user_id)).fetchone()
    if not existing:
        return jsonify({"error": "Transaksi tidak ditemukan."}), 404

    if request.method == "DELETE":
        db.execute("DELETE FROM transactions WHERE id = ?;", (tx_id,))
        db.commit()
        return jsonify({"message": "Transaksi berhasil dihapus."}), 200

    # PUT UPDATE
    data = request.get_json(silent=True) or {}
    tx_type = str(data.get("type", existing["type"])).lower()
    title = str(data.get("title", "")).strip()
    amount = float(data.get("amount") or 0)
    category = str(data.get("category", "Umum"))
    account = str(data.get("account", "Tunai / Cash"))
    date = data.get("date")

    if not title or amount <= 0:
        return jsonify({"error": "Judul dan nominal transaksi harus valid."}), 400

    # Check balance simulation
    net_bal = calculate_user_net_balance(db, user_id)
    if existing["type"] == "income":
        net_bal -= existing["amount"]
    else:
        net_bal += existing["amount"]

    if tx_type in ("expense", "goal_saving") and amount > net_bal:
        return jsonify({
            "error": f"Gagal update: Saldo tidak mencukupi! Saldo yang tersedia Rp {net_bal:,.0f}, sedangkan pengeluaran baru Rp {amount:,.0f}."
        }), 400

    db.execute("""
        UPDATE transactions
        SET type = ?, title = ?, amount = ?, category = ?, account = ?, date = COALESCE(?, date)
        WHERE id = ?;
    """, (tx_type, title, amount, category, account, date, tx_id))
    db.commit()

    return jsonify({"message": "Transaksi berhasil diperbarui!"}), 200


@app.route("/api/user/reset", methods=["POST"])
@login_required
def reset_user_data():
    """Clear all goals and transactions for current authenticated user."""
    user_id = get_current_user_id()
    db = get_db()
    db.execute("DELETE FROM transactions WHERE user_id = ?;", (user_id,))
    db.execute("DELETE FROM goals WHERE user_id = ?;", (user_id,))
    db.commit()
    return jsonify({"message": "Seluruh data transaksi dan goal akun ini telah dibersihkan."}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Server bawaan Flask hanya untuk pengembangan lokal. Produksi gunakan Gunicorn.
    app.run(host="127.0.0.1", port=port, debug=False)
