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


if __name__ == "__main__":
    unittest.main()
