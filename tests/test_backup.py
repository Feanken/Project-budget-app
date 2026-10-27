from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from backup_database import backup_database
import database


class BackupTests(unittest.TestCase):
    def test_backup_contains_wal_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'live.db'
            output = Path(directory) / 'backup.db'
            connection = sqlite3.connect(str(source))
            try:
                connection.execute('PRAGMA journal_mode=WAL')
                connection.execute('PRAGMA wal_autocheckpoint=0')
                for table in ('users', 'transactions', 'goals', 'categories', 'accounts'):
                    connection.execute(f'CREATE TABLE {table} (value TEXT)')
                connection.execute("INSERT INTO transactions VALUES ('from-wal')")
                connection.commit()
                self.assertTrue(Path(str(source) + '-wal').exists())
                backup_database(source, output)
                with closing(sqlite3.connect(str(output))) as copied:
                    self.assertEqual(copied.execute('SELECT value FROM transactions').fetchall(), [('from-wal',)])
                    self.assertEqual(copied.execute('PRAGMA integrity_check').fetchone(), ('ok',))
                before = output.read_bytes()
                with self.assertRaises(FileExistsError):
                    backup_database(source, output)
                self.assertEqual(output.read_bytes(), before)
            finally:
                connection.close()

    def test_missing_and_invalid_sources_do_not_leave_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'missing.db'
            output = Path(directory) / 'backup.db'
            with self.assertRaises(FileNotFoundError):
                backup_database(source, output)
            self.assertFalse(output.exists())
            source.write_bytes(b'not a database')
            with self.assertRaises(sqlite3.Error):
                backup_database(source, output)
            self.assertFalse(output.exists())

    def test_configured_missing_database_does_not_create_empty_file(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / 'does-not-exist.db'
            with patch.dict('os.environ', {'SMARTBUDGET_DB_PATH': str(missing)}), patch.object(database, 'DATABASE_PATH', str(missing)):
                with self.assertRaises(RuntimeError):
                    database.init_db()
            self.assertFalse(missing.exists())


if __name__ == '__main__':
    unittest.main()
