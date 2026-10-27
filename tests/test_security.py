"""Security checks using an isolated temporary database."""
import os
import tempfile
import unittest

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


if __name__ == "__main__":
    unittest.main()
