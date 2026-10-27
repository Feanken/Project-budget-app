/**
 * Goal Model
 * Represents a financial savings target with its progress and state.
 */
class Goal {
  /**
   * @param {Object} param0
   * @param {string} [param0.id]
   * @param {string} param0.title
   * @param {number} param0.targetAmount
   * @param {number} [param0.currentAmount=0]
   * @param {string} [param0.category='Tabungan']
   * @param {string} [param0.deadline=null]
   * @param {string} [param0.createdAt=null]
   */
  constructor({ id = null, title, targetAmount, currentAmount = 0, category = 'Tabungan', deadline = null, createdAt = null }) {
    this.id = id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.title = String(title).trim();
    this.targetAmount = Math.max(0, Number(targetAmount) || 0);
    this.currentAmount = Math.max(0, Number(currentAmount) || 0);
    this.category = category || 'Tabungan';
    this.deadline = deadline ? String(deadline).split('T')[0] : null;
    this.createdAt = createdAt || new Date().toISOString();
  }

  /**
   * Menghitung persentase progres capaian goal (0 - 100%)
   * @returns {number}
   */
  getProgressPercentage() {
    if (this.targetAmount <= 0) return 100;
    const pct = (this.currentAmount / this.targetAmount) * 100;
    return Math.min(100, Math.round(pct * 10) / 10);
  }

  /**
   * Mendapatkan sisa nominal yang harus dikumpulkan
   * @returns {number}
   */
  getRemainingAmount() {
    return Math.max(0, this.targetAmount - this.currentAmount);
  }

  /**
   * Cek apakah target sudah tercapai
   * @returns {boolean}
   */
  isCompleted() {
    return this.currentAmount >= this.targetAmount && this.targetAmount > 0;
  }

  /**
   * Menambahkan alokasi tabungan ke dalam goal ini
   * @param {number} amount
   * @returns {number} Saldo goal setelah penambahan
   */
  deposit(amount) {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) {
      throw new Error('Nominal alokasi tabungan harus berupa angka lebih dari 0.');
    }
    this.currentAmount += val;
    return this.currentAmount;
  }

  /**
   * Mendapatkan class warna progres berdasarkan persentase
   * @returns {'progress-danger' | 'progress-warning' | 'progress-success'}
   */
  getProgressColorClass() {
    const pct = this.getProgressPercentage();
    if (pct < 35) return 'progress-danger';
    if (pct < 75) return 'progress-warning';
    return 'progress-success';
  }

  /**
   * Konversi objek menjadi format plain JSON untuk storage
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      targetAmount: this.targetAmount,
      currentAmount: this.currentAmount,
      category: this.category,
      deadline: this.deadline,
      createdAt: this.createdAt
    };
  }

  /**
   * Factory method untuk membuat instance Goal dari data mentah JSON
   * @param {Object} data 
   * @returns {Goal}
   */
  static fromJSON(data) {
    return new Goal({
      id: data.id,
      title: data.title,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount,
      category: data.category,
      deadline: data.deadline,
      createdAt: data.createdAt
    });
  }
}
