"""Read-only checks for potential historical SmartBudget inconsistencies."""
import argparse
from contextlib import closing
from pathlib import Path
import sqlite3
import sys


def audit_database(path):
    source = Path(path).expanduser().resolve(strict=True)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=10)) as db:
        db.execute('PRAGMA query_only = ON')
        db.execute('BEGIN')  # Hold one consistent read snapshot for all checks.
        required = {'users', 'transactions', 'goals', 'categories', 'accounts'}
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not required <= tables:
            raise ValueError('File bukan database SmartBudget yang lengkap.')
        integrity = [row[0] for row in db.execute('PRAGMA integrity_check')]
        foreign_keys = list(db.execute('PRAGMA foreign_key_check'))
        negative_balance = list(db.execute('''
            SELECT user_id, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END)
            FROM transactions GROUP BY user_id HAVING SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) < -0.000001
        '''))
        goal_mismatches = list(db.execute('''
            SELECT g.id, g.user_id FROM goals g
            LEFT JOIN transactions t ON t.goal_id = g.id AND t.user_id = g.user_id AND t.type = 'goal_saving'
            GROUP BY g.id, g.user_id, g.current_amount
            HAVING ABS(g.current_amount - COALESCE(SUM(t.amount), 0)) > 0.000001
        '''))
        invalid_goals = list(db.execute('''
            SELECT id, user_id FROM goals WHERE target_amount <= 0 OR current_amount < 0 OR current_amount > target_amount
               OR target_amount IS NULL OR current_amount IS NULL
        '''))
        invalid_transactions = list(db.execute('''
            SELECT id, user_id FROM transactions WHERE amount <= 0 OR amount IS NULL
               OR type NOT IN ('income', 'expense', 'goal_saving')
        '''))
        fractional = list(db.execute('''
            SELECT id, user_id FROM transactions WHERE amount != CAST(amount AS INTEGER)
        '''))
        fractional_goals = list(db.execute('''
            SELECT id, user_id FROM goals WHERE target_amount != CAST(target_amount AS INTEGER)
                OR current_amount != CAST(current_amount AS INTEGER)
        '''))
        cross_user_goals = list(db.execute('''
            SELECT t.id, t.user_id, t.goal_id FROM transactions t
            JOIN goals g ON g.id = t.goal_id WHERE t.user_id != g.user_id
        '''))
        unlinked = list(db.execute("SELECT id, user_id FROM transactions WHERE type='goal_saving' AND goal_id IS NULL"))
        duplicates = list(db.execute('''
            SELECT user_id, GROUP_CONCAT(id), COUNT(*) FROM transactions
            GROUP BY user_id, type, title, amount, category, account, substr(date, 1, 10)
            HAVING COUNT(*) > 1
        '''))
        return {
            'integrity': integrity, 'foreign_keys': foreign_keys,
            'negative_balance': negative_balance, 'goal_mismatches': goal_mismatches,
            'invalid_goals': invalid_goals, 'invalid_transactions': invalid_transactions,
            'fractional': fractional, 'fractional_goals': fractional_goals,
            'cross_user_goals': cross_user_goals, 'unlinked': unlinked, 'duplicates': duplicates,
        }


def main():
    parser = argparse.ArgumentParser(description='Periksa database SmartBudget tanpa mengubah data.')
    parser.add_argument('--database', required=True, help='Path database atau salinan backup')
    args = parser.parse_args()
    try:
        report = audit_database(args.database)
    except (OSError, sqlite3.Error, ValueError) as exc:
        print(f'Pemeriksaan gagal: {exc}', file=sys.stderr)
        return 1
    print('Integritas SQLite:', ', '.join(report['integrity']))
    checks = [
        ('Pelanggaran foreign key', 'foreign_keys'),
        ('Akun dengan saldo negatif (ID pengguna, saldo)', 'negative_balance'),
        ('Goal berbeda dari total setoran terkait (ID goal, ID pengguna)', 'goal_mismatches'),
        ('Goal dengan nominal tidak valid (ID goal, ID pengguna)', 'invalid_goals'),
        ('Transaksi dengan nominal/tipe tidak valid (ID transaksi, ID pengguna)', 'invalid_transactions'),
        ('Transaksi dengan nominal pecahan (ID transaksi, ID pengguna)', 'fractional'),
        ('Goal dengan nominal pecahan (ID goal, ID pengguna)', 'fractional_goals'),
        ('Transaksi terkait goal pengguna lain (ID transaksi, ID pengguna, ID goal)', 'cross_user_goals'),
        ('Setoran tanpa goal terkait (ID transaksi, ID pengguna)', 'unlinked'),
        ('Kemungkinan duplikat (ID pengguna, ID transaksi, jumlah)', 'duplicates'),
    ]
    for label, key in checks:
        rows = report[key]
        print(f'{label}: {len(rows)}')
        for row in rows[:50]:
            print('  ', row)
        if len(rows) > 50:
            print(f'  ... {len(rows) - 50} hasil lainnya tidak ditampilkan')
    print('Catatan: duplikat dan setoran tanpa goal adalah petunjuk, bukan bukti kesalahan; jangan hapus otomatis.')
    return 2 if report['integrity'] != ['ok'] or any(report[key] for _, key in checks) else 0


if __name__ == '__main__':
    raise SystemExit(main())
