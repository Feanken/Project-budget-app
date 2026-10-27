/**
 * StorageManager Service
 * Encapsulates persistence logic with per-user data isolation.
 * Automatically synchronizes with Flask SQLite REST API when running on server,
 * and maintains local caching for instant UI response and offline fallback.
 */
class StorageManager {
  /**
   * @param {string} [userId='default']
   */
  constructor(userId = 'default') {
    this.userId = userId || 'default';
    this.prefix = `smartbudget_${this.userId}_`;
    this.goalsKey = `${this.prefix}goals`;
    this.txKey = `${this.prefix}transactions`;
    this.catKey = `${this.prefix}categories`;
    this.accountsKey = `${this.prefix}accounts`;
    this.isHttpMode = window.location.protocol.startsWith('http');

    this.defaultCategories = [
      'Makan & Minum',
      'Kebutuhan Harian',
      'Tagihan & Utilitas',
      'Transportasi',
      'Self-Care & Hiburan',
      'Pendidikan & Kursus',
      'Gaji & Pendapatan',
      'Project Sampingan',
      'Umum'
    ];

    this.defaultAccounts = [
      'Tunai / Cash',
      'Bank BCA',
      'Bank Mandiri',
      'Bank BNI',
      'Bank BRI',
      'GoPay',
      'OVO',
      'Dana',
      'Kartu Kredit'
    ];
  }

  /**
   * Mengambil data terbaru dari server Flask SQLite saat aplikasi dimuat
   */
  async syncFromServer() {
    if (!this.isHttpMode) return;
    const [cats, accounts, goals, transactions] = await Promise.all(
      ['/api/categories', '/api/accounts', '/api/goals', '/api/transactions'].map(path => this.request(path))
    );
    if (![cats, accounts, goals, transactions].every(Array.isArray)) throw new Error('Data server tidak valid.');
    this.saveCategories(cats);
    this.saveAccounts(accounts);
    this.saveGoals(goals);
    this.saveTransactions(transactions);
  }

  async request(path, method = 'GET', data) {
    let response;
    try {
      response = await fetch(path, { method, headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    } catch (e) {
      const error = new Error('Server tidak dapat dihubungi. Muat ulang dan periksa data setelah koneksi kembali sebelum mencoba lagi.');
      error.uncertain = method !== 'GET';
      throw error;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `Permintaan gagal (${response.status}).`);
      if (response.status >= 500 && method !== 'GET') {
        error.uncertain = true;
        error.message += ' Muat ulang dan periksa data sebelum mencoba lagi.';
      }
      throw error;
    }
    return result;
  }

  // ==========================================
  // GOALS PERSISTENCE & API SYNC
  // ==========================================
  getGoals() {
    try {
      const data = localStorage.getItem(this.goalsKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveGoals(goals) {
    try {
      const serialized = goals.map(g => (typeof g.toJSON === 'function' ? g.toJSON() : g));
      localStorage.setItem(this.goalsKey, JSON.stringify(serialized));
    } catch (e) {}
  }

  async createGoalOnServer(goalData) {
    if (!this.isHttpMode) return;
    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
      });
    } catch (e) {}
  }

  async depositGoalOnServer(goalId, amount, account) {
    if (!this.isHttpMode) return;
    try {
      await fetch(`/api/goals/${goalId}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, account })
      });
    } catch (e) {}
  }

  async deleteGoalOnServer(goalId) {
    if (!this.isHttpMode) return;
    try {
      await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
    } catch (e) {}
  }

  // ==========================================
  // TRANSACTIONS PERSISTENCE & API SYNC
  // ==========================================
  getTransactions() {
    try {
      const data = localStorage.getItem(this.txKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveTransactions(transactions) {
    try {
      const serialized = transactions.map(t => (typeof t.toJSON === 'function' ? t.toJSON() : t));
      localStorage.setItem(this.txKey, JSON.stringify(serialized));
    } catch (e) {}
  }

  async createTransactionOnServer(txData) {
    if (!this.isHttpMode) return;
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
    } catch (e) {}
  }

  async updateTransactionOnServer(id, txData) {
    if (!this.isHttpMode) return;
    try {
      await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
    } catch (e) {}
  }

  async deleteTransactionOnServer(id) {
    if (!this.isHttpMode) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    } catch (e) {}
  }

  // ==========================================
  // CATEGORIES & ACCOUNTS PERSISTENCE & API SYNC
  // ==========================================
  getCategories() {
    try {
      const data = localStorage.getItem(this.catKey);
      return data ? JSON.parse(data) : [...this.defaultCategories];
    } catch (e) {
      return [...this.defaultCategories];
    }
  }

  saveCategories(categories) {
    try {
      localStorage.setItem(this.catKey, JSON.stringify(categories));
    } catch (e) {}
  }

  async addCategoryOnServer(name) {
    if (!this.isHttpMode) return;
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
    } catch (e) {}
  }

  async deleteCategoryOnServer(name) {
    if (!this.isHttpMode) return;
    try {
      await fetch(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
    } catch (e) {}
  }

  getAccounts() {
    try {
      const data = localStorage.getItem(this.accountsKey);
      return data ? JSON.parse(data) : [...this.defaultAccounts];
    } catch (e) {
      return [...this.defaultAccounts];
    }
  }

  saveAccounts(accounts) {
    try {
      localStorage.setItem(this.accountsKey, JSON.stringify(accounts));
    } catch (e) {}
  }

  async addAccountOnServer(name) {
    if (!this.isHttpMode) return;
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
    } catch (e) {}
  }

  async deleteAccountOnServer(name) {
    if (!this.isHttpMode) return;
    try {
      await fetch(`/api/accounts/${encodeURIComponent(name)}`, { method: 'DELETE' });
    } catch (e) {}
  }

  async clearOnServer() {
    if (this.isHttpMode) {
      try {
        await fetch('/api/user/reset', { method: 'POST' });
      } catch (e) {}
    }
    this.clear();
  }

  clear() {
    localStorage.removeItem(this.goalsKey);
    localStorage.removeItem(this.txKey);
    localStorage.removeItem(this.catKey);
    localStorage.removeItem(this.accountsKey);
  }
}
