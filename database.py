"""
Database Module for SmartBudget App
Uses SQLite with Write-Ahead Logging (WAL) mode for maximum speed
and lowest memory footprint on 1 vCPU & 1 GiB RAM VM.
"""

import sqlite3
import os

try:
    from flask import g
except ImportError:
    g = None

DATABASE_PATH = os.environ.get("SMARTBUDGET_DB_PATH") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "smartbudget.db")


def get_db():
    """Get active database connection for the current request context."""
    if g is not None:
        if "db" not in g:
            g.db = sqlite3.connect(DATABASE_PATH, timeout=10.0)
            g.db.execute("PRAGMA foreign_keys = ON;")
            g.db.execute("PRAGMA journal_mode = WAL;")
            g.db.row_factory = sqlite3.Row
        return g.db
    else:
        conn = sqlite3.connect(DATABASE_PATH, timeout=10.0)
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.row_factory = sqlite3.Row
        return conn


def close_db(e=None):
    """Close database connection at end of request."""
    if g is not None:
        db = g.pop("db", None)
        if db is not None:
            db.close()


def init_db():
    """Initialize database tables schema."""
    if os.environ.get("SMARTBUDGET_DB_PATH") and not os.path.isfile(DATABASE_PATH):
        raise RuntimeError("Database pada SMARTBUDGET_DB_PATH tidak ditemukan; periksa lokasi sebelum menjalankan aplikasi.")
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Categories Table (Per-user)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name COLLATE NOCASE)
        );
    """)

    # 3. Payment Accounts Table (Per-user)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name COLLATE NOCASE)
        );
    """)

    # 4. Goals Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            target_amount REAL NOT NULL,
            current_amount REAL DEFAULT 0.0,
            category TEXT DEFAULT 'Tabungan',
            deadline DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)

    # 5. Transactions Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'goal_saving')),
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT DEFAULT 'Umum',
            account TEXT DEFAULT 'Tunai / Cash',
            goal_id INTEGER,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
        );
    """)

    conn.commit()
    conn.close()


def seed_default_user_options(db, user_id):
    """Seed initial categories and accounts for a newly registered user."""
    default_categories = [
      'Makan & Minum',
      'Kebutuhan Harian',
      'Tagihan & Utilitas',
      'Transportasi',
      'Self-Care & Hiburan',
      'Pendidikan & Kursus',
      'Gaji & Pendapatan',
      'Project Sampingan',
      'Umum'
    ]
    for cat in default_categories:
        db.execute(
            "INSERT OR IGNORE INTO categories (user_id, name) VALUES (?, ?);",
            (user_id, cat)
        )

    default_accounts = [
      'Tunai / Cash',
      'Bank BCA',
      'Bank Mandiri',
      'Bank BNI',
      'Bank BRI',
      'GoPay',
      'OVO',
      'Dana',
      'Kartu Kredit'
    ]
    for acc in default_accounts:
        db.execute(
            "INSERT OR IGNORE INTO accounts (user_id, name) VALUES (?, ?);",
            (user_id, acc)
        )
    db.commit()


if __name__ == "__main__":
    init_db()
    print("Database tables initialized successfully in WAL mode.")
