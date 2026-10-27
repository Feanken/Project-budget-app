"""Create a consistent SQLite backup without overwriting existing files."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
import sys


def backup_database(source, destination):
    source = Path(source).expanduser().resolve(strict=True)
    destination = Path(destination).expanduser().absolute()
    if not source.is_file():
        raise ValueError("Sumber harus berupa file database yang sudah ada.")
    if source == destination.resolve():
        raise ValueError("Lokasi backup harus berbeda dari database sumber.")
    # Only remove this output on failure if this invocation created it.
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=10)) as src:
            tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {'users', 'transactions', 'goals', 'categories', 'accounts'} <= tables:
                raise ValueError('Sumber bukan database SmartBudget yang lengkap.')
            with closing(sqlite3.connect(str(destination), timeout=10)) as dst:
                src.backup(dst)
                check = dst.execute('PRAGMA integrity_check').fetchone()
                if check != ('ok',):
                    raise RuntimeError('Pemeriksaan integritas backup gagal.')
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    return destination


def main():
    parser = argparse.ArgumentParser(description='Buat backup SQLite yang konsisten, termasuk data dalam WAL.')
    parser.add_argument('--source', required=True, help='Path database sumber yang sudah ada')
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--output', help='Path file backup baru; file tidak boleh sudah ada')
    target.add_argument('--directory', help='Folder backup; nama file dibuat berdasarkan waktu UTC')
    args = parser.parse_args()
    try:
        output = args.output
        if args.directory:
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            output = str(Path(args.directory) / f'smartbudget-{timestamp}.db')
        result = backup_database(args.source, output)
    except (OSError, ValueError, sqlite3.Error, RuntimeError) as exc:
        print(f'Backup gagal: {exc}', file=sys.stderr)
        return 1
    print(f'Backup berhasil dan lulus pemeriksaan integritas: {result}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
