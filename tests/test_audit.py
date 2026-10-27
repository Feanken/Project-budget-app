from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import database
from audit_database import audit_database


class AuditTests(unittest.TestCase):
    def test_audit_finds_issues_without_changing_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.db'
            with patch.dict('os.environ', {}, clear=True), patch.object(database, 'DATABASE_PATH', str(path)):
                database.init_db()
            with closing(sqlite3.connect(str(path))) as conn:
                conn.execute("INSERT INTO users (id, username, password_hash) VALUES (1, 'test', 'hash')")
                conn.execute("INSERT INTO goals (id, user_id, title, target_amount, current_amount) VALUES (1, 1, 'goal', 100, 25)")
                conn.executemany("INSERT INTO transactions (user_id, type, title, amount, category, account, date) VALUES (1, 'expense', 'same', 12.5, 'x', 'x', '2026-01-01')", [(), ()])
                conn.commit()
                before = conn.execute('SELECT * FROM transactions').fetchall()
                report = audit_database(path)
                self.assertEqual(report['integrity'], ['ok'])
                self.assertEqual(len(report['negative_balance']), 1)
                self.assertEqual(len(report['goal_mismatches']), 1)
                self.assertEqual(len(report['fractional']), 2)
                self.assertEqual(len(report['duplicates']), 1)
                self.assertEqual(conn.execute('SELECT * FROM transactions').fetchall(), before)

    def test_missing_database_not_created(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing.db'
            with self.assertRaises(FileNotFoundError):
                audit_database(path)
            self.assertFalse(path.exists())


if __name__ == '__main__':
    unittest.main()
