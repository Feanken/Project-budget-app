/**
 * AuthManager Service
 * Handles user registration, authentication, sessions, and data isolation between accounts.
 * Supports dual-mode: connects to Flask SQLite API when served over HTTP,
 * with automatic fallback to LocalStorage for standalone local preview.
 */
class AuthManager {
  constructor() {
    this.usersStorageKey = 'smartbudget_auth_users';
    this.sessionStorageKey = 'smartbudget_auth_session';
    this.isHttpMode = window.location.protocol.startsWith('http');
  }

  getRegisteredUsers() {
    try {
      const data = localStorage.getItem(this.usersStorageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  async register({ userId, password, confirmPassword }) {
    const cleanId = String(userId || '').trim().toLowerCase();
    const pass = String(password || '');
    const confirm = String(confirmPassword || '');

    if (!cleanId || cleanId.length < 3) {
      throw new Error('ID Pengguna minimal terdiri dari 3 karakter.');
    }
    if (!pass || pass.length < 4) {
      throw new Error('Kata sandi minimal 4 karakter.');
    }
    if (pass !== confirm) {
      throw new Error('Konfirmasi kata sandi tidak cocok!');
    }

    if (this.isHttpMode) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanId, password: pass, confirm_password: confirm })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal melakukan registrasi ke server.');
      }
      const sessionData = { userId: data.user.username, id: data.user.id };
      localStorage.setItem(this.sessionStorageKey, JSON.stringify(sessionData));
      return sessionData;
    }

    // Standalone LocalStorage Fallback
    const users = this.getRegisteredUsers();
    if (users.some(u => u.userId.toLowerCase() === cleanId)) {
      throw new Error(`ID Pengguna "${cleanId}" sudah terdaftar.`);
    }

    const newUser = {
      userId: cleanId,
      passwordHash: btoa(pass),
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(this.usersStorageKey, JSON.stringify(users));

    return this.login(cleanId, pass);
  }

  async login(userId, password) {
    const cleanId = String(userId || '').trim().toLowerCase();
    const pass = String(password || '');

    if (!cleanId || !pass) {
      throw new Error('Harap isi ID Pengguna dan kata sandi!');
    }

    if (this.isHttpMode) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanId, password: pass })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ID Pengguna atau kata sandi salah.');
      }
      const sessionData = { userId: data.user.username, id: data.user.id };
      localStorage.setItem(this.sessionStorageKey, JSON.stringify(sessionData));
      return sessionData;
    }

    // Standalone LocalStorage Fallback
    const users = this.getRegisteredUsers();
    const user = users.find(u => u.userId.toLowerCase() === cleanId);
    if (!user) {
      throw new Error(`ID Pengguna "${cleanId}" tidak ditemukan.`);
    }
    if (user.passwordHash !== btoa(pass)) {
      throw new Error('Kata sandi yang Anda masukkan salah!');
    }

    const sessionData = {
      userId: user.userId,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(this.sessionStorageKey, JSON.stringify(sessionData));
    return sessionData;
  }

  async logout() {
    if (this.isHttpMode) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
    }
    localStorage.removeItem(this.sessionStorageKey);
  }

  getCurrentUser() {
    try {
      const session = localStorage.getItem(this.sessionStorageKey);
      return session ? JSON.parse(session) : null;
    } catch (e) {
      return null;
    }
  }

  isLoggedIn() {
    return this.getCurrentUser() !== null;
  }
}
