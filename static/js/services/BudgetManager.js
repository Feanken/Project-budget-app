/**
 * BudgetManager Service
 * Orchestrates core financial business logic, strict balance validations,
 * calendar date aggregations, custom categories & payment accounts management,
 * CSV Export/Import, and transparent SQLite synchronization.
 */
class BudgetManager {
  /**
   * @param {StorageManager} storageManager
   */
  constructor(storageManager) {
    this.storage = storageManager;
    /** @type {Array<Goal>} */
    this.goals = [];
    /** @type {Array<Transaction>} */
    this.transactions = [];
    /** @type {Array<string>} */
    this.categories = [];
    /** @type {Array<string>} */
    this.accounts = [];
    
    this.init();
  }

  /**
   * Muat data dari penyimpanan lokal / cache
   */
  init() {
    const rawGoals = this.storage.getGoals();
    const rawTx = this.storage.getTransactions();

    this.goals = rawGoals.map(g => Goal.fromJSON(g));
    this.transactions = rawTx.map(t => Transaction.fromJSON(t));
    this.categories = this.storage.getCategories();
    this.accounts = this.storage.getAccounts();
  }

  /**
   * Sinkronisasi data dengan server Flask SQLite (mode HTTP)
   */
  async syncServer() {
    await this.storage.syncFromServer();
    this.init();
  }

  async serverChange(path, method, data) {
    if (this.needsRefresh) throw new Error('Muat ulang halaman sebelum melakukan perubahan lagi.');
    if (this.saving) throw new Error('Perubahan lain masih diproses.');
    this.saving = true;
    try {
      const result = await this.storage.request(path, method, data);
      try {
        await this.syncServer();
      } catch (e) {
        this.needsRefresh = true;
        throw new Error('Perubahan tersimpan, tetapi pembaruan tampilan gagal. Muat ulang halaman sebelum melakukan perubahan lagi.');
      }
      return result;
    } catch (e) {
      if (e.uncertain) this.needsRefresh = true;
      throw e;
    } finally {
      this.saving = false;
    }
  }

  async resetAllData() {
    if (this.storage.isHttpMode) return this.serverChange('/api/user/reset', 'POST');
    this.goals = [];
    this.transactions = [];
    await this.storage.clearOnServer();
  }

  // ==========================================
  // CUSTOM CATEGORIES MANAGEMENT
  // ==========================================
  getCategories() {
    return this.categories;
  }

  async addCategory(name) {
    const clean = String(name || '').trim();
    if (!clean) {
      throw new Error('Nama kategori tidak boleh kosong!');
    }
    const exists = this.categories.some(c => c.toLowerCase() === clean.toLowerCase());
    if (exists) {
      throw new Error(`Kategori "${clean}" sudah ada.`);
    }
    if (this.storage.isHttpMode) {
      await this.serverChange('/api/categories', 'POST', {name: clean});
      return clean;
    }
    this.categories.push(clean);
    this.storage.saveCategories(this.categories);
    this.storage.addCategoryOnServer(clean);
    return clean;
  }

  async deleteCategory(name) {
    if (this.categories.length <= 1) {
      throw new Error('Minimal harus ada 1 kategori dalam sistem.');
    }
    if (this.storage.isHttpMode) return this.serverChange(`/api/categories/${encodeURIComponent(name)}`, 'DELETE');
    this.categories = this.categories.filter(c => c.toLowerCase() !== name.toLowerCase());
    this.storage.saveCategories(this.categories);
    this.storage.deleteCategoryOnServer(name);
  }

  // ==========================================
  // PAYMENT ACCOUNTS / METHODS MANAGEMENT
  // ==========================================
  getAccounts() {
    return this.accounts;
  }

  async addAccount(name) {
    const clean = String(name || '').trim();
    if (!clean) {
      throw new Error('Nama rekening / metode pembayaran tidak boleh kosong!');
    }
    const exists = this.accounts.some(a => a.toLowerCase() === clean.toLowerCase());
    if (exists) {
      throw new Error(`Rekening/Metode "${clean}" sudah ada.`);
    }
    if (this.storage.isHttpMode) {
      await this.serverChange('/api/accounts', 'POST', {name: clean});
      return clean;
    }
    this.accounts.push(clean);
    this.storage.saveAccounts(this.accounts);
    this.storage.addAccountOnServer(clean);
    return clean;
  }

  async deleteAccount(name) {
    if (this.accounts.length <= 1) {
      throw new Error('Minimal harus ada 1 rekening / metode pembayaran dalam sistem.');
    }
    if (this.storage.isHttpMode) return this.serverChange(`/api/accounts/${encodeURIComponent(name)}`, 'DELETE');
    this.accounts = this.accounts.filter(a => a.toLowerCase() !== name.toLowerCase());
    this.storage.saveAccounts(this.accounts);
    this.storage.deleteAccountOnServer(name);
  }

  // ==========================================
  // GOAL METHODS WITH BALANCE PROTECTION
  // ==========================================

  async addGoal({ title, targetAmount, currentAmount = 0, category = 'Tabungan', deadline = null }) {
    const numTarget = Math.max(0, Number(targetAmount) || 0);
    const numInitial = Math.max(0, Number(currentAmount) || 0);

    if (numTarget <= 0) {
      throw new Error('Target nominal harus lebih besar dari 0!');
    }

    if (numInitial > 0) {
      const netBalance = this.getNetBalance();
      if (numInitial > netBalance) {
        throw new Error(
          `Saldo Anda tidak mencukupi untuk setoran awal! Saldo bersih saat ini Rp ${this.formatNumber(netBalance)}, sedangkan setoran awal Rp ${this.formatNumber(numInitial)}.`
        );
      }
      if (numInitial > numTarget) {
        throw new Error('Saldo awal tidak boleh melebihi target nominal impian!');
      }
    }

    if (this.storage.isHttpMode) {
      const result = await this.serverChange('/api/goals', 'POST', {title, target_amount: numTarget,
        current_amount: numInitial, category, deadline, account: this.accounts[0] || 'Tunai / Cash'});
      return this.goals.find(g => g.id === String(result.id));
    }
    const newGoal = new Goal({
      title,
      targetAmount: numTarget,
      currentAmount: numInitial,
      category,
      deadline
    });

    this.goals.unshift(newGoal);
    this.storage.saveGoals(this.goals);

    // Sync to SQLite Server
    this.storage.createGoalOnServer({
      title,
      target_amount: numTarget,
      current_amount: numInitial,
      category,
      deadline,
      account: this.accounts[0] || 'Tunai / Cash'
    });

    if (numInitial > 0) {
      this.addTransaction({
        type: 'goal_saving',
        title: `Setoran Awal: ${newGoal.title}`,
        amount: numInitial,
        category: 'Goal Saving',
        account: this.accounts[0] || 'Tunai / Cash',
        goalId: newGoal.id
      });
    }

    return newGoal;
  }

  async deleteGoal(goalId) {
    if (this.storage.isHttpMode) return this.serverChange(`/api/goals/${encodeURIComponent(goalId)}`, 'DELETE');
    this.goals = this.goals.filter(g => g.id !== goalId);
    this.storage.saveGoals(this.goals);
    this.storage.deleteGoalOnServer(goalId);
  }

  async depositToGoal(goalId, amount, account = null) {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) {
      throw new Error('Target goal tidak ditemukan.');
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Nominal alokasi tabungan harus lebih dari 0.');
    }

    const netBalance = this.getNetBalance();
    if (numAmount > netBalance) {
      throw new Error(
        `Saldo tidak mencukupi! Saldo bersih Anda saat ini Rp ${this.formatNumber(netBalance)}, sedangkan nominal yang ingin ditabung Rp ${this.formatNumber(numAmount)}.`
      );
    }

    const remaining = goal.getRemainingAmount();
    if (numAmount > remaining) {
      throw new Error(
        `Nominal alokasi (Rp ${this.formatNumber(numAmount)}) melebihi sisa kebutuhan target ini (Rp ${this.formatNumber(remaining)})!`
      );
    }

    const selectedAccount = account || this.accounts[0] || 'Tunai / Cash';
    if (this.storage.isHttpMode) {
      await this.serverChange(`/api/goals/${encodeURIComponent(goalId)}/deposit`, 'POST', {amount: numAmount, account: selectedAccount});
      return this.goals.find(g => g.id === goalId);
    }
    goal.deposit(numAmount);
    this.storage.saveGoals(this.goals);

    // Sync to SQLite Server
    this.storage.depositGoalOnServer(goalId, numAmount, selectedAccount);

    this.addTransaction({
      type: 'goal_saving',
      title: `Nabung: ${goal.title}`,
      amount: numAmount,
      category: 'Goal Saving',
      account: selectedAccount,
      goalId: goal.id
    });

    return goal;
  }

  getFilteredGoals(filter = 'all') {
    if (filter === 'active') {
      return this.goals.filter(g => !g.isCompleted());
    }
    if (filter === 'completed') {
      return this.goals.filter(g => g.isCompleted());
    }
    return this.goals;
  }

  getTotalGoalsTarget() {
    return this.goals.reduce((sum, g) => sum + g.targetAmount, 0);
  }

  getTotalGoalsCollected() {
    return this.goals.reduce((sum, g) => sum + g.currentAmount, 0);
  }

  getOverallProgressPercentage() {
    const target = this.getTotalGoalsTarget();
    if (target <= 0) return 0;
    const pct = (this.getTotalGoalsCollected() / target) * 100;
    return Math.min(100, Math.round(pct * 10) / 10);
  }

  // ==========================================
  // TRANSACTION METHODS WITH BALANCE PROTECTION
  // ==========================================

  async addTransaction({ type, title, amount, category = 'Umum', account = null, goalId = null, date = null }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Nominal transaksi harus lebih besar dari 0!');
    }

    if (type === 'expense') {
      const netBalance = this.getNetBalance();
      if (numAmount > netBalance) {
        throw new Error(
          `Saldo tidak mencukupi! Saldo bersih saat ini Rp ${this.formatNumber(netBalance)}, sedangkan pengeluaran yang dimasukkan Rp ${this.formatNumber(numAmount)}.`
        );
      }
    }

    const selectedAccount = account || this.accounts[0] || 'Tunai / Cash';
    if (this.storage.isHttpMode) {
      const result = await this.serverChange('/api/transactions', 'POST', {type, title, amount: numAmount, category, account: selectedAccount, date});
      return this.transactions.find(t => t.id === String(result.id));
    }
    const tx = new Transaction({
      type,
      title,
      amount: numAmount,
      category: category || 'Umum',
      account: selectedAccount,
      goalId,
      date: date || new Date().toISOString()
    });

    this.transactions.unshift(tx);
    this.storage.saveTransactions(this.transactions);

    // Sync to SQLite Server
    this.storage.createTransactionOnServer({
      type,
      title,
      amount: numAmount,
      category: tx.category,
      account: selectedAccount,
      date: tx.date
    });

    return tx;
  }

  getTransactionById(id) {
    return this.transactions.find(t => t.id === id) || null;
  }

  async updateTransaction(id, updatedData) {
    const tx = this.getTransactionById(id);
    if (!tx) {
      throw new Error('Transaksi tidak ditemukan.');
    }

    const newAmount = Number(updatedData.amount);
    if (isNaN(newAmount) || newAmount <= 0) {
      throw new Error('Nominal transaksi harus lebih besar dari 0!');
    }

    let currentBalanceWithoutTx = this.getNetBalance();
    if (tx.type === 'income') {
      currentBalanceWithoutTx -= tx.amount;
    } else {
      currentBalanceWithoutTx += tx.amount;
    }

    const newType = updatedData.type || tx.type;
    if (newType === 'expense' || newType === 'goal_saving') {
      if (newAmount > currentBalanceWithoutTx) {
        throw new Error(
          `Gagal memperbarui: Saldo tidak mencukupi! Saldo yang tersedia Rp ${this.formatNumber(currentBalanceWithoutTx)}, sedangkan perubahan pengeluaran menjadi Rp ${this.formatNumber(newAmount)}.`
        );
      }
    }

    if (this.storage.isHttpMode) {
      await this.serverChange(`/api/transactions/${encodeURIComponent(id)}`, 'PUT', updatedData);
      return this.getTransactionById(id);
    }
    tx.update(updatedData);
    this.storage.saveTransactions(this.transactions);

    // Sync to SQLite Server
    this.storage.updateTransactionOnServer(id, {
      type: tx.type,
      title: tx.title,
      amount: tx.amount,
      category: tx.category,
      account: tx.account,
      date: tx.date
    });

    return tx;
  }

  async deleteTransaction(id) {
    if (this.storage.isHttpMode) return this.serverChange(`/api/transactions/${encodeURIComponent(id)}`, 'DELETE');
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.storage.saveTransactions(this.transactions);
    this.storage.deleteTransactionOnServer(id);
  }

  getFilteredTransactions({ type = 'all', searchQuery = '', category = 'all', account = 'all' } = {}) {
    return this.transactions
      .filter(t => {
        if (type !== 'all' && t.type !== type) return false;
        if (category && category !== 'all' && t.category !== category) return false;
        if (account && account !== 'all' && t.account !== account) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchCat = t.category.toLowerCase().includes(q);
          const matchAcc = (t.account || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCat && !matchAcc) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getTotalIncome() {
    return this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getTotalExpense() {
    return this.transactions
      .filter(t => t.type === 'expense' || t.type === 'goal_saving')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getNetBalance() {
    return this.getTotalIncome() - this.getTotalExpense();
  }

  getSurplusDetails() {
    const totalIncome = this.getTotalIncome();
    const totalExpense = this.getTotalExpense();
    const netSurplus = totalIncome - totalExpense;
    const isSurplus = netSurplus >= 0;
    const percentageSurplus = totalIncome > 0 ? Math.round((netSurplus / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalExpense,
      netSurplus,
      isSurplus,
      percentageSurplus
    };
  }

  getRecentTransactions(limit = 6) {
    return [...this.transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  // ==========================================
  // GOOGLE CALENDAR VIEW DATA METHODS
  // ==========================================

  getTransactionsForDay(isoDate) {
    return this.transactions
      .filter(t => t.date.split('T')[0] === isoDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getCalendarMonthData(year, month) {
    const monthData = new Map();

    this.transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateKey = t.date.split('T')[0];
        if (!monthData.has(dateKey)) {
          monthData.set(dateKey, { income: 0, expense: 0, count: 0, transactions: [] });
        }
        const item = monthData.get(dateKey);
        item.count += 1;
        item.transactions.push(t);
        if (t.type === 'income') {
          item.income += t.amount;
        } else {
          item.expense += t.amount;
        }
      }
    });

    return monthData;
  }

  getCashFlowTimeline(timeframe = '7days') {
    if (this.transactions.length === 0) {
      return {
        hasData: false,
        labels: [],
        incomeData: [],
        expenseData: [],
        dates: []
      };
    }

    const now = new Date();
    let numDays = 7;

    if (timeframe === 'today') numDays = 1;
    else if (timeframe === '7days') numDays = 7;
    else if (timeframe === '30days') numDays = 30;
    else if (timeframe === 'all') numDays = 45;

    const dayMap = new Map();
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      
      const label = d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: numDays > 7 ? 'numeric' : 'short'
      });

      dayMap.set(isoDate, {
        label,
        income: 0,
        expense: 0
      });
    }

    let actualDataCount = 0;
    this.transactions.forEach(t => {
      const tDate = t.date.split('T')[0];
      if (dayMap.has(tDate)) {
        actualDataCount++;
        const entry = dayMap.get(tDate);
        if (t.type === 'income') {
          entry.income += t.amount;
        } else {
          entry.expense += t.amount;
        }
      }
    });

    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const dates = [];

    for (const [key, val] of dayMap.entries()) {
      dates.push(key);
      labels.push(val.label);
      incomeData.push(val.income);
      expenseData.push(val.expense);
    }

    return {
      hasData: actualDataCount > 0 || this.transactions.length > 0,
      labels,
      incomeData,
      expenseData,
      dates
    };
  }

  // ==========================================
  // EXPORT & IMPORT CSV
  // ==========================================

  exportToCSV() {
    const headers = ['Tanggal', 'Waktu', 'Keterangan', 'Kategori', 'Rekening/Metode', 'Tipe', 'Nominal (Rp)'];
    const rows = this.transactions.map(t => {
      const d = new Date(t.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const cleanTitle = `"${(t.title || '').replace(/"/g, '""')}"`;
      const cleanCat = `"${(t.category || '').replace(/"/g, '""')}"`;
      const cleanAcc = `"${(t.account || '').replace(/"/g, '""')}"`;
      const typeLabel = t.type === 'income' ? 'Pemasukan' : (t.type === 'goal_saving' ? 'Tabungan Goal' : 'Pengeluaran');
      return [dateStr, timeStr, cleanTitle, cleanCat, cleanAcc, typeLabel, t.amount].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  }

  async importFromCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('File CSV kosong atau tidak valid.');
    }
    if (this.storage.isHttpMode) {
      const result = await this.serverChange('/api/transactions/import', 'POST', {csv: csvText});
      return result.count;
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      throw new Error('File CSV tidak memiliki baris data transaksi.');
    }

    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      if (parts.length >= 6) {
        const clean = str => String(str || '').replace(/^"|"$/g, '').trim();
        const dateStr = clean(parts[0]);
        const timeStr = clean(parts[1]);
        const title = clean(parts[2]);
        const category = clean(parts[3]) || 'Umum';
        const account = clean(parts[4]) || 'Tunai / Cash';
        const typeRaw = clean(parts[5]).toLowerCase();
        const amount = parseFloat(clean(parts[6]));

        if (title && !isNaN(amount) && amount > 0) {
          let type = 'expense';
          if (typeRaw.includes('masuk') || typeRaw === 'income') type = 'income';
          else if (typeRaw.includes('goal') || typeRaw.includes('tabungan')) type = 'goal_saving';

          let isoDate = new Date().toISOString();
          try {
            if (dateStr) {
              const fullStr = timeStr ? `${dateStr}T${timeStr}:00` : dateStr;
              isoDate = new Date(fullStr).toISOString();
            }
          } catch {}

          if (!this.categories.some(c => c.toLowerCase() === category.toLowerCase())) {
            this.categories.push(category);
          }
          if (!this.accounts.some(a => a.toLowerCase() === account.toLowerCase())) {
            this.accounts.push(account);
          }

          const newTx = new Transaction({
            type,
            title,
            amount,
            category,
            account,
            date: isoDate
          });
          this.transactions.push(newTx);
          this.storage.createTransactionOnServer({
            type,
            title,
            amount,
            category,
            account,
            date: isoDate
          });
          importedCount++;
        }
      }
    }

    if (importedCount > 0) {
      this.storage.saveCategories(this.categories);
      this.storage.saveAccounts(this.accounts);
      this.storage.saveTransactions(this.transactions);
    }

    return importedCount;
  }

  formatNumber(val) {
    return new Intl.NumberFormat('id-ID').format(Math.round(val || 0));
  }
}
