/**
 * Transaction Model
 * Represents a financial income, expense, or savings allocation record,
 * including category and payment account / method (Cash, BCA, etc.).
 */
class Transaction {
  /**
   * @param {Object} param0
   * @param {string} [param0.id]
   * @param {'income' | 'expense' | 'goal_saving'} param0.type
   * @param {string} param0.title
   * @param {number} param0.amount
   * @param {string} [param0.category='Umum']
   * @param {string} [param0.account='Tunai / Cash']
   * @param {string|null} [param0.goalId=null]
   * @param {string} [param0.date=null]
   */
  constructor({ id = null, type, title, amount, category = 'Umum', account = 'Tunai / Cash', goalId = null, date = null }) {
    this.id = id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.type = type; // 'income' | 'expense' | 'goal_saving'
    this.title = String(title).trim();
    this.amount = Math.max(0, Number(amount) || 0);
    this.category = category || 'Umum';
    this.account = account || 'Tunai / Cash';
    this.goalId = goalId || null;
    this.date = date ? new Date(date).toISOString() : new Date().toISOString();
  }

  isIncome() {
    return this.type === 'income';
  }

  isExpense() {
    return this.type === 'expense' || this.type === 'goal_saving';
  }

  /**
   * Update transaksi dengan data baru
   * @param {Object} updatedData
   */
  update({ type, title, amount, category, account, date }) {
    if (type !== undefined) this.type = type;
    if (title !== undefined) this.title = String(title).trim();
    if (amount !== undefined) this.amount = Math.max(0, Number(amount) || 0);
    if (category !== undefined) this.category = category || 'Umum';
    if (account !== undefined) this.account = account || 'Tunai / Cash';
    if (date !== undefined) this.date = new Date(date).toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      amount: this.amount,
      category: this.category,
      account: this.account,
      goalId: this.goalId,
      date: this.date
    };
  }

  static fromJSON(data) {
    return new Transaction({
      id: data.id,
      type: data.type,
      title: data.title,
      amount: data.amount,
      category: data.category,
      account: data.account || 'Tunai / Cash',
      goalId: data.goalId,
      date: data.date
    });
  }
}
