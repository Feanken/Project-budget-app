"""Security checks using an isolated temporary database."""
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

os.environ["SECRET_KEY"] = "test-only-key-" + "x" * 40
os.environ["SESSION_COOKIE_SECURE"] = "true"

import database

temp_dir = tempfile.TemporaryDirectory()
database.DATABASE_PATH = os.path.join(temp_dir.name, "test.db")

from app import app


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.headers = {"X-Requested-With": "XMLHttpRequest"}

    def test_mutations_require_header(self):
        response = self.client.post("/api/auth/login", json={"username": "x", "password": "x"})
        self.assertEqual(response.status_code, 403)
        response = self.client.post("/api/auth/login", headers=self.headers, json={"username": "x", "password": "x"})
        self.assertEqual(response.status_code, 401)

    def test_registration_and_session(self):
        short = {"username": "short", "password": "abc", "confirm_password": "abc"}
        self.assertEqual(self.client.post("/api/auth/register", json=short, headers=self.headers).status_code, 400)
        password = "a-long-test-password"
        data = {"username": "alice", "password": password, "confirm_password": password}
        response = self.client.post("/api/auth/register", json=data, headers=self.headers)
        self.assertEqual(response.status_code, 201)
        cookie = response.headers["Set-Cookie"]
        for attribute in ("Secure", "HttpOnly", "SameSite=Lax", "Expires="):
            self.assertIn(attribute, cookie)
        self.assertEqual(self.client.get("/api/auth/me").get_json()["user"]["username"], "alice")
        self.assertEqual(self.client.post("/api/auth/logout", headers=self.headers).status_code, 200)
        self.assertIsNone(self.client.get("/api/auth/me").get_json()["user"])
        response = self.client.post("/api/auth/login", json={"username": "alice", "password": password}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_cross_user_access_and_reset(self):
        alice, bob, anonymous = app.test_client(), app.test_client(), app.test_client()
        for client, username in ((alice, "isolation-alice"), (bob, "isolation-bob")):
            data = {"username": username, "password": "safe-test-password", "confirm_password": "safe-test-password"}
            self.assertEqual(client.post('/api/auth/register', json=data, headers=self.headers).status_code, 201)
        def post(client, path, data):
            return client.post(path, json=data, headers=self.headers)
        tx = post(alice, '/api/transactions', {"type": "income", "title": "private-income", "amount": 100})
        goal = post(alice, '/api/goals', {"title": "private-goal", "target_amount": 50})
        self.assertEqual(tx.status_code, 201)
        self.assertEqual(goal.status_code, 201)
        tx_id, goal_id = tx.json['id'], goal.json['id']
        self.assertEqual(post(alice, '/api/categories', {"name": "private-category"}).status_code, 201)
        self.assertEqual(post(alice, '/api/accounts', {"name": "private-account"}).status_code, 201)
        for path in ('/api/transactions', '/api/goals', '/api/categories', '/api/accounts'):
            self.assertEqual(anonymous.get(path).status_code, 401)
            self.assertNotIn('private-', str(bob.get(path).json))
        self.assertEqual(bob.delete(f'/api/transactions/{tx_id}', headers=self.headers).status_code, 404)
        self.assertEqual(bob.put(f'/api/transactions/{tx_id}', json={"title": "changed", "amount": 1}, headers=self.headers).status_code, 404)
        self.assertEqual(bob.delete(f'/api/goals/{goal_id}', headers=self.headers).status_code, 404)
        self.assertEqual(post(bob, f'/api/goals/{goal_id}/deposit', {"amount": 1}).status_code, 404)
        self.assertEqual(bob.delete('/api/categories/private-category', headers=self.headers).status_code, 404)
        self.assertEqual(bob.delete('/api/accounts/private-account', headers=self.headers).status_code, 404)
        self.assertEqual(post(bob, '/api/user/reset', {}).status_code, 200)
        self.assertEqual(alice.get('/api/transactions').json[0]['title'], 'private-income')
        self.assertEqual(alice.get('/api/goals').json[0]['title'], 'private-goal')
        self.assertIn('private-category', alice.get('/api/categories').json)
        self.assertIn('private-account', alice.get('/api/accounts').json)

    def test_balances_goal_deposits_and_validation(self):
        client = app.test_client()
        post = lambda path, data: client.post(path, json=data, headers=self.headers)
        post('/api/auth/register', {'username': 'finance-test', 'password': 'long-test-password', 'confirm_password': 'long-test-password'})
        income = post('/api/transactions', {'type': 'income', 'title': 'Gaji', 'amount': 100}).json['id']
        self.assertEqual(post('/api/transactions', {'type': 'income', 'title': 'bad', 'amount': 'abc'}).status_code, 400)
        self.assertEqual(post('/api/transactions', {'type': 'expense', 'title': 'bad', 'amount': 'Infinity'}).status_code, 400)
        self.assertEqual(post('/api/goals', {'title': 'bad', 'target_amount': 20, 'current_amount': 21}).status_code, 400)
        goal = post('/api/goals', {'title': 'Trip', 'target_amount': 60, 'current_amount': 20}).json['id']
        self.assertEqual(post(f'/api/goals/{goal}/deposit', {'amount': 10}).status_code, 200)
        transactions = client.get('/api/transactions').json
        savings = [t for t in transactions if t['goalId'] == str(goal)]
        self.assertEqual(len(savings), 2)
        self.assertEqual(client.get('/api/goals').json[0]['currentAmount'], 30)
        self.assertEqual(client.delete(f'/api/transactions/{income}', headers=self.headers).status_code, 400)
        self.assertEqual(client.put(f'/api/transactions/{savings[0]["id"]}', json={'title': 'edit', 'amount': 1}, headers=self.headers).status_code, 400)
        self.assertEqual(client.delete(f'/api/transactions/{savings[0]["id"]}', headers=self.headers).status_code, 200)
        self.assertEqual(client.get('/api/goals').json[0]['currentAmount'], 20)

    def test_csv_import_is_atomic(self):
        client = app.test_client()
        post = lambda path, data: client.post(path, json=data, headers=self.headers)
        post('/api/auth/register', {'username': 'csv-test', 'password': 'long-test-password', 'confirm_password': 'long-test-password'})
        header = 'Tanggal,Waktu,Keterangan,Kategori,Rekening/Metode,Tipe,Nominal (Rp)\n'
        invalid = header + '2026-01-01,10:00,Gaji,Gaji,Tunai,Pemasukan,10\n2026-01-02,10:00,Belanja,Makan,Tunai,Pengeluaran,20\n'
        self.assertEqual(post('/api/transactions/import', {'csv': invalid}).status_code, 400)
        self.assertEqual(client.get('/api/transactions').json, [])
        valid = invalid.replace('Pengeluaran,20', 'Pengeluaran,5')
        response = post('/api/transactions/import', {'csv': valid})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json['count'], 2)
        self.assertEqual(len(client.get('/api/transactions').json), 2)

    def test_simultaneous_expenses_cannot_overdraw(self):
        creator = app.test_client()
        password = 'long-test-password'
        creator.post('/api/auth/register', json={'username': 'race-test', 'password': password, 'confirm_password': password}, headers=self.headers)
        creator.post('/api/transactions', json={'type': 'income', 'title': 'income', 'amount': 100}, headers=self.headers)
        clients = [app.test_client(), app.test_client()]
        for client in clients:
            self.assertEqual(client.post('/api/auth/login', json={'username': 'race-test', 'password': password}, headers=self.headers).status_code, 200)
        barrier = Barrier(2)
        def spend(client):
            barrier.wait(timeout=5)
            return client.post('/api/transactions', json={'type': 'expense', 'title': 'expense', 'amount': 80}, headers=self.headers).status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(spend, clients))
        self.assertEqual(sorted(statuses), [201, 400])


if __name__ == "__main__":
    unittest.main()
