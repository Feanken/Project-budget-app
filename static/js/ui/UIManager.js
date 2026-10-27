/**
 * CurrencyInputMask Utility
 * Menangani masking otomatis titik ribuan (misal: 5000000 -> 5.000.000)
 */
class CurrencyInputMask {
  static attach(inputElement) {
    if (!inputElement) return;

    inputElement.setAttribute('inputmode', 'numeric');
    inputElement.setAttribute('autocomplete', 'off');

    inputElement.addEventListener('input', (e) => {
      const el = e.target;
      const rawValue = el.value.replace(/\D/g, '');
      if (!rawValue) {
        el.value = '';
        return;
      }
      const num = parseInt(rawValue, 10);
      el.value = new Intl.NumberFormat('id-ID').format(num);
    });
  }

  static getRawNumber(inputElement) {
    if (!inputElement) return 0;
    const raw = String(inputElement.value).replace(/\D/g, '');
    return raw ? parseFloat(raw) : 0;
  }

  static setFormattedValue(inputElement, number) {
    if (!inputElement) return;
    if (number === null || number === undefined || isNaN(number) || number === 0) {
      inputElement.value = '';
      return;
    }
    inputElement.value = new Intl.NumberFormat('id-ID').format(Math.round(number));
  }
}

/**
 * UIManager
 * Handles all UI rendering, Auth screens, Settings, dynamic categories & accounts,
 * Google Calendar view, Excel spreadsheet, Chart.js, and CSV Import/Export.
 */
class UIManager {
  /**
   * @param {AuthManager} authManager
   */
  constructor(authManager) {
    this.auth = authManager;
    /** @type {BudgetManager|null} */
    this.bm = null;

    this.currentGoalFilter = 'all';
    this.currentTxTypeFilter = 'all';
    this.currentTxCategoryFilter = 'all';
    this.currentTxAccountFilter = 'all';
    this.currentTxSearch = '';
    this.currentTimeframe = '7days';
    this.activeView = 'dashboard'; // 'dashboard' | 'transactions' | 'settings'
    this.txViewMode = 'calendar';  // 'calendar' | 'table'

    const today = new Date();
    this.calYear = today.getFullYear();
    this.calMonth = today.getMonth();
    this.selectedCalDate = today.toISOString().split('T')[0];

    /** @type {Chart|null} */
    this.chartInstance = null;

    this.initElements();
  }

  /**
   * Set instance BudgetManager saat pengguna login
   * @param {BudgetManager} budgetManager 
   */
  setBudgetManager(budgetManager) {
    this.bm = budgetManager;
  }

  initElements() {
    this.elements = {
      // Auth Containers
      viewAuth: document.getElementById('view-auth'),
      viewApp: document.getElementById('view-app'),
      appNavbar: document.getElementById('app-navbar'),

      // Auth Tabs & Forms
      authTabLogin: document.getElementById('auth-tab-login'),
      authTabRegister: document.getElementById('auth-tab-register'),
      formLogin: document.getElementById('form-login'),
      formRegister: document.getElementById('form-register'),
      loginUserId: document.getElementById('login-userid'),
      loginPassword: document.getElementById('login-password'),
      regUserId: document.getElementById('reg-userid'),
      regPassword: document.getElementById('reg-password'),
      regConfirmPassword: document.getElementById('reg-confirm-password'),

      // User Profile in Navbar
      navUserBadge: document.getElementById('nav-user-badge'),
      navUsernameLabel: document.getElementById('nav-username-label'),
      btnLogout: document.getElementById('btn-logout'),

      // Navigation Tabs
      navTabDashboard: document.getElementById('nav-tab-dashboard'),
      navTabTransactions: document.getElementById('nav-tab-transactions'),
      navTabSettings: document.getElementById('nav-tab-settings'),
      viewDashboard: document.getElementById('view-dashboard'),
      viewTransactions: document.getElementById('view-transactions'),
      viewSettings: document.getElementById('view-settings'),

      // Metric Cards (Dashboard)
      valBalance: document.getElementById('val-balance'),
      valIncome: document.getElementById('val-income'),
      valExpense: document.getElementById('val-expense'),
      valGoalsCollected: document.getElementById('val-goals-collected'),
      valGoalsTarget: document.getElementById('val-goals-target'),
      valGoalsPct: document.getElementById('val-goals-pct'),
      
      // Overall Progress
      overallPctLabel: document.getElementById('overall-pct-label'),
      overallProgressBar: document.getElementById('overall-progress-bar'),

      // Goals List & Filters
      goalsContainer: document.getElementById('goals-list-container'),
      goalsEmptyState: document.getElementById('goals-empty-state'),
      filterButtons: document.querySelectorAll('.filter-btn'),

      // Form Tambah Goal
      formCreateGoal: document.getElementById('form-create-goal'),
      goalTitleInput: document.getElementById('goal-title'),
      goalTargetInput: document.getElementById('goal-target'),
      goalInitialInput: document.getElementById('goal-initial'),
      goalCategoryInput: document.getElementById('goal-category'),
      goalDeadlineInput: document.getElementById('goal-deadline'),

      // Recent Transactions Widget
      txContainer: document.getElementById('tx-list-container'),
      txCountBadge: document.getElementById('tx-count-badge'),

      // Deposit Modal
      modalDeposit: document.getElementById('modal-deposit'),
      formDeposit: document.getElementById('form-deposit-goal'),
      depositGoalId: document.getElementById('deposit-goal-id'),
      depositTitle: document.getElementById('deposit-target-title'),
      depositCurrent: document.getElementById('deposit-current-amt'),
      depositTarget: document.getElementById('deposit-target-amt'),
      depositRemaining: document.getElementById('deposit-remaining-amt'),
      depositAmount: document.getElementById('deposit-amount'),
      depositAccount: document.getElementById('deposit-account'),
      btnCloseDepositModal: document.getElementById('btn-close-deposit-modal'),
      btnCancelDeposit: document.getElementById('btn-cancel-deposit'),

      // Transaction Create Modal
      modalTx: document.getElementById('modal-transaction'),
      formTx: document.getElementById('form-create-tx'),
      txTitleInput: document.getElementById('tx-title'),
      txAmountInput: document.getElementById('tx-amount'),
      txCategorySelect: document.getElementById('tx-category-select'),
      txAccountSelect: document.getElementById('tx-account-select'),
      txDateInput: document.getElementById('tx-date'),
      btnOpenTxModal: document.getElementById('btn-open-tx-modal'),
      btnOpenTxModal2: document.getElementById('btn-open-tx-modal-2'),
      btnOpenTxModalCal: document.getElementById('btn-open-tx-modal-cal'),
      btnCloseTxModal: document.getElementById('btn-close-tx-modal'),
      btnCancelTx: document.getElementById('btn-cancel-tx'),
      btnQuickGoal: document.getElementById('btn-quick-goal'),

      // Edit Transaction Modal
      modalEditTx: document.getElementById('modal-edit-transaction'),
      formEditTx: document.getElementById('form-edit-tx'),
      editTxId: document.getElementById('edit-tx-id'),
      editTxTitle: document.getElementById('edit-tx-title'),
      editTxAmount: document.getElementById('edit-tx-amount'),
      editTxCategory: document.getElementById('edit-tx-category'),
      editTxAccount: document.getElementById('edit-tx-account'),
      editTxDate: document.getElementById('edit-tx-date'),
      btnCloseEditTxModal: document.getElementById('btn-close-edit-tx-modal'),
      btnCancelEditTx: document.getElementById('btn-cancel-edit-tx'),

      // Surplus & Ledger Header Cards
      surplusValue: document.getElementById('ledger-surplus-value'),
      surplusStatusBadge: document.getElementById('ledger-surplus-status'),
      ledgerTotalIncome: document.getElementById('ledger-total-income'),
      ledgerTotalExpense: document.getElementById('ledger-total-expense'),
      ledgerSavingRate: document.getElementById('ledger-saving-rate'),

      // Chart & Timeframe
      chartCanvas: document.getElementById('cashflow-chart'),
      chartEmptyPlaceholder: document.getElementById('chart-empty-placeholder'),
      timeframeButtons: document.querySelectorAll('.timeframe-btn'),

      // Transaction View Mode Switchers
      btnViewCalendar: document.getElementById('btn-view-calendar'),
      btnViewTable: document.getElementById('btn-view-table'),
      calendarSectionWrapper: document.getElementById('calendar-section-wrapper'),
      tableSectionWrapper: document.getElementById('table-section-wrapper'),

      // Google Calendar Elements
      calMonthLabel: document.getElementById('cal-month-label'),
      btnCalPrev: document.getElementById('btn-cal-prev'),
      btnCalNext: document.getElementById('btn-cal-next'),
      btnCalToday: document.getElementById('btn-cal-today'),
      calendarDaysGrid: document.getElementById('calendar-days-grid'),
      dayDetailDateLabel: document.getElementById('day-detail-date-label'),
      dayDetailIncomeBadge: document.getElementById('day-detail-income-badge'),
      dayDetailExpenseBadge: document.getElementById('day-detail-expense-badge'),
      dayDetailTxList: document.getElementById('day-detail-tx-list'),
      dayDetailEmptyState: document.getElementById('day-detail-empty-state'),

      // Excel Table Elements
      excelTableBody: document.getElementById('excel-table-body'),
      excelEmptyState: document.getElementById('excel-empty-state'),
      excelSearchInput: document.getElementById('excel-search-input'),
      excelTypeFilter: document.getElementById('excel-type-filter'),
      excelCatFilter: document.getElementById('excel-cat-filter'),
      excelAccFilter: document.getElementById('excel-acc-filter'),
      excelCountBadge: document.getElementById('excel-count-badge'),
      excelFootIncome: document.getElementById('excel-foot-income'),
      excelFootExpense: document.getElementById('excel-foot-expense'),
      excelFootSurplus: document.getElementById('excel-foot-surplus'),

      // Settings Elements
      settingsUserIdLabel: document.getElementById('settings-user-id-label'),
      categoryListContainer: document.getElementById('settings-category-list'),
      formAddCategory: document.getElementById('form-add-category'),
      newCategoryInput: document.getElementById('new-category-input'),
      accountListContainer: document.getElementById('settings-account-list'),
      formAddAccount: document.getElementById('form-add-account'),
      newAccountInput: document.getElementById('new-account-input'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      formImportCSV: document.getElementById('form-import-csv'),
      fileInputCSV: document.getElementById('file-input-csv'),
      btnResetUserData: document.getElementById('btn-reset-user-data'),

      // Toast Notification
      toastContainer: document.getElementById('toast-container')
    };
  }

  static formatCurrency(amount) {
    const num = Math.round(Number(amount) || 0);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  static formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      const opts = {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      };
      if (includeTime) {
        opts.hour = '2-digit';
        opts.minute = '2-digit';
      }
      return date.toLocaleDateString('id-ID', opts);
    } catch {
      return dateStr;
    }
  }

  init() {
    this.setupMasking();
    this.setupEventListeners();
    this.checkAuthStatus();
  }

  setupMasking() {
    CurrencyInputMask.attach(this.elements.goalTargetInput);
    CurrencyInputMask.attach(this.elements.goalInitialInput);
    CurrencyInputMask.attach(this.elements.depositAmount);
    CurrencyInputMask.attach(this.elements.txAmountInput);
    CurrencyInputMask.attach(this.elements.editTxAmount);
  }

  // ==========================================
  // AUTHENTICATION MANAGEMENT
  // ==========================================

  async checkAuthStatus() {
    const user = await this.auth.verifyCurrentUser();
    if (user) {
      this.elements.viewAuth.classList.add('hidden');
      this.elements.viewApp.classList.remove('hidden');
      if (this.elements.navUsernameLabel) {
        this.elements.navUsernameLabel.textContent = user.userId;
      }
      if (this.elements.settingsUserIdLabel) {
        this.elements.settingsUserIdLabel.textContent = user.userId;
      }
      // Re-initialize per-user Storage & BudgetManager
      const storage = new StorageManager(user.userId);
      this.bm = new BudgetManager(storage);
      // Sync from Flask SQLite database
      try {
        await this.bm.syncServer();
        this.render();
      } catch (err) {
        this.elements.viewAuth.classList.remove('hidden');
        this.elements.viewApp.classList.add('hidden');
        this.showToast(err.message, 'danger');
      }
    } else {
      this.elements.viewAuth.classList.remove('hidden');
      this.elements.viewApp.classList.add('hidden');
    }
  }

  setupEventListeners() {
    // 1. Auth Tabs Switcher (Login vs Register)
    if (this.elements.authTabLogin && this.elements.authTabRegister) {
      this.elements.authTabLogin.addEventListener('click', () => {
        this.elements.authTabLogin.classList.add('active');
        this.elements.authTabRegister.classList.remove('active');
        this.elements.formLogin.classList.remove('hidden');
        this.elements.formRegister.classList.add('hidden');
      });

      this.elements.authTabRegister.addEventListener('click', () => {
        this.elements.authTabRegister.classList.add('active');
        this.elements.authTabLogin.classList.remove('active');
        this.elements.formRegister.classList.remove('hidden');
        this.elements.formLogin.classList.add('hidden');
      });
    }

    // 2. Submit Login & Register
    if (this.elements.formLogin) {
      this.elements.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = this.elements.loginUserId.value;
        const pass = this.elements.loginPassword.value;
        try {
          await this.auth.login(userId, pass);
          this.showToast(`Selamat datang kembali, ${userId}! 👋`, 'success');
          this.elements.formLogin.reset();
          await this.checkAuthStatus();
        } catch (err) {
          this.showToast(err.message, 'danger');
        }
      });
    }

    if (this.elements.formRegister) {
      this.elements.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = this.elements.regUserId.value;
        const pass = this.elements.regPassword.value;
        const confirm = this.elements.regConfirmPassword.value;
        try {
          await this.auth.register({ userId, password: pass, confirmPassword: confirm });
          this.showToast(`Akun "${userId}" berhasil dibuat! 🎉`, 'success');
          this.elements.formRegister.reset();
          await this.checkAuthStatus();
        } catch (err) {
          this.showToast(err.message, 'danger');
        }
      });
    }

    // 3. Logout
    if (this.elements.btnLogout) {
      this.elements.btnLogout.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin keluar dari akun ini?')) {
          this.auth.logout();
          this.showToast('Anda telah keluar dari aplikasi.', 'info');
          this.checkAuthStatus();
        }
      });
    }

    // 4. Main Navigation Switcher (Dashboard, Transactions, Settings)
    if (this.elements.navTabDashboard) {
      this.elements.navTabDashboard.addEventListener('click', () => this.switchView('dashboard'));
    }
    if (this.elements.navTabTransactions) {
      this.elements.navTabTransactions.addEventListener('click', () => this.switchView('transactions'));
    }
    if (this.elements.navTabSettings) {
      this.elements.navTabSettings.addEventListener('click', () => this.switchView('settings'));
    }

    // 5. Switcher Mode Transaksi: Kalender vs Spreadsheet
    if (this.elements.btnViewCalendar && this.elements.btnViewTable) {
      this.elements.btnViewCalendar.addEventListener('click', () => this.switchTxViewMode('calendar'));
      this.elements.btnViewTable.addEventListener('click', () => this.switchTxViewMode('table'));
    }

    // 6. Kontrol Kalender
    if (this.elements.btnCalPrev) {
      this.elements.btnCalPrev.addEventListener('click', () => {
        this.calMonth--;
        if (this.calMonth < 0) {
          this.calMonth = 11;
          this.calYear--;
        }
        this.renderCalendar();
      });
    }
    if (this.elements.btnCalNext) {
      this.elements.btnCalNext.addEventListener('click', () => {
        this.calMonth++;
        if (this.calMonth > 11) {
          this.calMonth = 0;
          this.calYear++;
        }
        this.renderCalendar();
      });
    }
    if (this.elements.btnCalToday) {
      this.elements.btnCalToday.addEventListener('click', () => {
        const now = new Date();
        this.calYear = now.getFullYear();
        this.calMonth = now.getMonth();
        this.selectedCalDate = now.toISOString().split('T')[0];
        this.renderCalendar();
        this.renderCalendarDayDetail(this.selectedCalDate);
      });
    }

    // 7. Submit Form Tambah Goal
    if (this.elements.formCreateGoal) {
      this.elements.formCreateGoal.addEventListener('submit', (e) => this.handleCreateGoal(e));
    }

    // 8. Filter Tabs Goals
    this.elements.filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        this.elements.filterButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.currentGoalFilter = target.getAttribute('data-filter') || 'all';
        this.renderGoals();
      });
    });

    // 9. Timeframe Selector Grafik
    this.elements.timeframeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        this.elements.timeframeButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.currentTimeframe = target.getAttribute('data-timeframe') || '7days';
        this.renderCashflowChart();
      });
    });

    // 10. Filter & Pencarian Tabel Excel
    if (this.elements.excelSearchInput) {
      this.elements.excelSearchInput.addEventListener('input', (e) => {
        this.currentTxSearch = e.target.value.trim();
        this.renderExcelTable();
      });
    }
    if (this.elements.excelTypeFilter) {
      this.elements.excelTypeFilter.addEventListener('change', (e) => {
        this.currentTxTypeFilter = e.target.value;
        this.renderExcelTable();
      });
    }
    if (this.elements.excelCatFilter) {
      this.elements.excelCatFilter.addEventListener('change', (e) => {
        this.currentTxCategoryFilter = e.target.value;
        this.renderExcelTable();
      });
    }
    if (this.elements.excelAccFilter) {
      this.elements.excelAccFilter.addEventListener('change', (e) => {
        this.currentTxAccountFilter = e.target.value;
        this.renderExcelTable();
      });
    }

    // 11. Modal Tambah Tabungan Goal (Deposit)
    if (this.elements.formDeposit) {
      this.elements.formDeposit.addEventListener('submit', (e) => this.handleDepositSubmit(e));
    }
    if (this.elements.btnCloseDepositModal) {
      this.elements.btnCloseDepositModal.addEventListener('click', () => this.closeDepositModal());
    }
    if (this.elements.btnCancelDeposit) {
      this.elements.btnCancelDeposit.addEventListener('click', () => this.closeDepositModal());
    }

    // 12. Modal Catat Transaksi Baru
    const openTxBtns = [
      this.elements.btnOpenTxModal,
      this.elements.btnOpenTxModal2,
      this.elements.btnOpenTxModalCal
    ];
    openTxBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', () => this.openTxModal());
    });

    if (this.elements.btnCloseTxModal) {
      this.elements.btnCloseTxModal.addEventListener('click', () => this.closeTxModal());
    }
    if (this.elements.btnCancelTx) {
      this.elements.btnCancelTx.addEventListener('click', () => this.closeTxModal());
    }
    if (this.elements.formTx) {
      this.elements.formTx.addEventListener('submit', (e) => this.handleTxSubmit(e));
    }

    // On-the-fly Category & Account additions inside Transaction Modal
    if (this.elements.txCategorySelect) {
      this.elements.txCategorySelect.addEventListener('change', async (e) => {
        if (e.target.value === '__add_new__') {
          const newName = prompt('Masukkan nama kategori baru:');
          if (newName && newName.trim()) {
            try {
              const added = await this.bm.addCategory(newName);
              this.populateDropdowns();
              this.elements.txCategorySelect.value = added;
              this.showToast(`Kategori "${added}" ditambahkan!`, 'success');
            } catch (err) {
              this.showToast(err.message, 'danger');
              this.populateDropdowns();
            }
          } else {
            this.populateDropdowns();
          }
        }
      });
    }

    if (this.elements.txAccountSelect) {
      this.elements.txAccountSelect.addEventListener('change', async (e) => {
        if (e.target.value === '__add_new__') {
          const newName = prompt('Masukkan nama rekening / metode pembayaran baru (contoh: Bank BCA, GoPay):');
          if (newName && newName.trim()) {
            try {
              const added = await this.bm.addAccount(newName);
              this.populateDropdowns();
              this.elements.txAccountSelect.value = added;
              this.showToast(`Rekening/Metode "${added}" ditambahkan!`, 'success');
            } catch (err) {
              this.showToast(err.message, 'danger');
              this.populateDropdowns();
            }
          } else {
            this.populateDropdowns();
          }
        }
      });
    }

    // 13. Modal Edit Transaksi
    if (this.elements.formEditTx) {
      this.elements.formEditTx.addEventListener('submit', (e) => this.handleEditTxSubmit(e));
    }
    if (this.elements.btnCloseEditTxModal) {
      this.elements.btnCloseEditTxModal.addEventListener('click', () => this.closeEditTxModal());
    }
    if (this.elements.btnCancelEditTx) {
      this.elements.btnCancelEditTx.addEventListener('click', () => this.closeEditTxModal());
    }

    // 14. Quick Goal shortcut
    if (this.elements.btnQuickGoal) {
      this.elements.btnQuickGoal.addEventListener('click', () => {
        this.switchView('dashboard');
        this.elements.goalTitleInput.focus();
        this.elements.goalTitleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    // 15. Settings: Add Category
    if (this.elements.formAddCategory) {
      this.elements.formAddCategory.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = this.elements.newCategoryInput.value.trim();
        try {
          await this.bm.addCategory(name);
          this.elements.formAddCategory.reset();
          this.showToast(`Kategori "${name}" berhasil ditambahkan!`, 'success');
          this.renderSettings();
          this.populateDropdowns();
        } catch (err) {
          this.showToast(err.message, 'danger');
        }
      });
    }

    // 16. Settings: Add Payment Account
    if (this.elements.formAddAccount) {
      this.elements.formAddAccount.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = this.elements.newAccountInput.value.trim();
        try {
          await this.bm.addAccount(name);
          this.elements.formAddAccount.reset();
          this.showToast(`Rekening/Metode "${name}" berhasil ditambahkan!`, 'success');
          this.renderSettings();
          this.populateDropdowns();
        } catch (err) {
          this.showToast(err.message, 'danger');
        }
      });
    }

    // 17. Settings: Export CSV
    if (this.elements.btnExportCSV) {
      this.elements.btnExportCSV.addEventListener('click', () => {
        const csvContent = this.bm.exportToCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const user = this.auth.getCurrentUser();
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `smartbudget_transaksi_${user ? user.userId : 'user'}_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Data transaksi berhasil diekspor ke file CSV/Excel! 📥', 'success');
      });
    }

    // 18. Settings: Import CSV
    if (this.elements.formImportCSV && this.elements.fileInputCSV) {
      this.elements.formImportCSV.addEventListener('submit', (e) => {
        e.preventDefault();
        const file = this.elements.fileInputCSV.files[0];
        if (!file) {
          this.showToast('Pilih file CSV terlebih dahulu!', 'danger');
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const count = await this.bm.importFromCSV(event.target.result);
            this.showToast(`Berhasil mengimpor ${count} transaksi! 📤`, 'success');
            this.elements.formImportCSV.reset();
            this.render();
          } catch (err) {
            this.showToast(err.message, 'danger');
          }
        };
        reader.readAsText(file);
      });
    }

    // 19. Settings: Reset User Data
    if (this.elements.btnResetUserData) {
      this.elements.btnResetUserData.addEventListener('click', async () => {
        if (confirm('PERINGATAN: Semua transaksi dan target impian di akun ini akan dihapus secara permanen. Lanjutkan?')) {
          try {
            await this.bm.resetAllData();
            this.showToast('Semua data akun ini telah dibersihkan.', 'info');
            this.render();
          } catch (err) { this.showToast(err.message, 'danger'); }
        }
      });
    }
  }

  // ==========================================
  // VIEW SWITCHING
  // ==========================================

  switchView(view) {
    this.activeView = view;
    
    // Remove active from all nav buttons
    this.elements.navTabDashboard.classList.remove('active');
    this.elements.navTabTransactions.classList.remove('active');
    this.elements.navTabSettings.classList.remove('active');

    // Hide all view containers
    this.elements.viewDashboard.classList.add('hidden');
    this.elements.viewTransactions.classList.add('hidden');
    this.elements.viewSettings.classList.add('hidden');

    if (view === 'dashboard') {
      this.elements.navTabDashboard.classList.add('active');
      this.elements.viewDashboard.classList.remove('hidden');
    } else if (view === 'transactions') {
      this.elements.navTabTransactions.classList.add('active');
      this.elements.viewTransactions.classList.remove('hidden');
      this.renderCashflowChart();
      if (this.txViewMode === 'calendar') {
        this.renderCalendar();
        this.renderCalendarDayDetail(this.selectedCalDate);
      } else {
        this.renderExcelTable();
      }
    } else if (view === 'settings') {
      this.elements.navTabSettings.classList.add('active');
      this.elements.viewSettings.classList.remove('hidden');
      this.renderSettings();
    }
  }

  switchTxViewMode(mode) {
    this.txViewMode = mode;
    if (mode === 'calendar') {
      this.elements.btnViewCalendar.classList.add('active');
      this.elements.btnViewTable.classList.remove('active');
      this.elements.calendarSectionWrapper.classList.remove('hidden');
      this.elements.tableSectionWrapper.classList.add('hidden');
      this.renderCalendar();
      this.renderCalendarDayDetail(this.selectedCalDate);
    } else {
      this.elements.btnViewCalendar.classList.remove('active');
      this.elements.btnViewTable.classList.add('active');
      this.elements.calendarSectionWrapper.classList.add('hidden');
      this.elements.tableSectionWrapper.classList.remove('hidden');
      this.renderExcelTable();
    }
  }

  // ==========================================
  // FORM HANDLERS (GOAL & TRANSACTIONS)
  // ==========================================

  async handleCreateGoal(e) {
    e.preventDefault();

    const title = this.elements.goalTitleInput.value.trim();
    const targetAmount = CurrencyInputMask.getRawNumber(this.elements.goalTargetInput);
    const initialAmount = CurrencyInputMask.getRawNumber(this.elements.goalInitialInput);
    const category = this.elements.goalCategoryInput.value;
    const deadline = this.elements.goalDeadlineInput.value || null;

    if (!title) {
      this.showToast('Nama target tidak boleh kosong!', 'danger');
      return;
    }
    if (targetAmount <= 0) {
      this.showToast('Target nominal harus lebih besar dari 0!', 'danger');
      return;
    }

    try {
      await this.bm.addGoal({
        title,
        targetAmount,
        currentAmount: initialAmount,
        category,
        deadline
      });

      this.elements.formCreateGoal.reset();
      this.showToast(`Target "${title}" berhasil ditambahkan! 🎯`, 'success');
      this.render();
    } catch (err) {
      this.showToast(err.message, 'danger');
    }
  }

  openDepositModal(goalId) {
    const goal = this.bm.goals.find(g => g.id === goalId);
    if (!goal) return;

    this.elements.depositGoalId.value = goal.id;
    this.elements.depositTitle.textContent = goal.title;
    this.elements.depositCurrent.textContent = UIManager.formatCurrency(goal.currentAmount);
    this.elements.depositTarget.textContent = UIManager.formatCurrency(goal.targetAmount);
    this.elements.depositRemaining.textContent = UIManager.formatCurrency(goal.getRemainingAmount());
    
    // Populate deposit account dropdown
    if (this.elements.depositAccount) {
      let accHtml = '';
      this.bm.getAccounts().forEach(a => {
        accHtml += `<option value="${this.escapeHtml(a)}">${this.escapeHtml(a)}</option>`;
      });
      this.elements.depositAccount.innerHTML = accHtml;
    }

    const remaining = goal.getRemainingAmount();
    const available = this.bm.getNetBalance();
    const maxPoss = Math.min(remaining, available > 0 ? available : remaining);
    
    this.elements.depositAmount.placeholder = `Maks: Rp ${new Intl.NumberFormat('id-ID').format(maxPoss)}`;
    this.elements.modalDeposit.classList.remove('hidden');
    setTimeout(() => this.elements.depositAmount.focus(), 100);
  }

  closeDepositModal() {
    this.elements.modalDeposit.classList.add('hidden');
  }

  async handleDepositSubmit(e) {
    e.preventDefault();
    const goalId = this.elements.depositGoalId.value;
    const amount = CurrencyInputMask.getRawNumber(this.elements.depositAmount);
    const account = this.elements.depositAccount ? this.elements.depositAccount.value : null;

    if (amount <= 0) {
      this.showToast('Masukkan nominal tabungan yang valid!', 'danger');
      return;
    }

    try {
      const updated = await this.bm.depositToGoal(goalId, amount, account);
      this.elements.formDeposit.reset();
      this.closeDepositModal();
      this.showToast(`Berhasil menabung ${UIManager.formatCurrency(amount)} untuk "${updated.title}"! 💰`, 'success');
      this.render();
    } catch (err) {
      this.showToast(err.message, 'danger');
    }
  }

  openTxModal(prefillDate = null) {
    if (prefillDate && this.elements.txDateInput) {
      this.elements.txDateInput.value = prefillDate;
    } else if (this.elements.txDateInput && !this.elements.txDateInput.value) {
      this.elements.txDateInput.value = new Date().toISOString().split('T')[0];
    }
    this.populateDropdowns();
    this.elements.modalTx.classList.remove('hidden');
    setTimeout(() => this.elements.txTitleInput.focus(), 100);
  }

  closeTxModal() {
    this.elements.modalTx.classList.add('hidden');
  }

  async handleTxSubmit(e) {
    e.preventDefault();
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const title = this.elements.txTitleInput.value.trim();
    const amount = CurrencyInputMask.getRawNumber(this.elements.txAmountInput);
    const category = this.elements.txCategorySelect.value;
    const account = this.elements.txAccountSelect.value;
    const dateVal = this.elements.txDateInput.value;
    const date = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

    if (!title || amount <= 0) {
      this.showToast('Harap lengkapi judul dan nominal transaksi yang valid!', 'danger');
      return;
    }

    try {
      await this.bm.addTransaction({ type, title, amount, category, account, date });
      this.elements.formTx.reset();
      this.closeTxModal();
      this.showToast(`Transaksi "${title}" berhasil dicatat!`, 'success');
      this.render();
    } catch (err) {
      this.showToast(err.message, 'danger');
    }
  }

  openEditTxModal(txId) {
    const tx = this.bm.getTransactionById(txId);
    if (!tx) {
      this.showToast('Transaksi tidak ditemukan!', 'danger');
      return;
    }

    this.elements.editTxId.value = tx.id;
    this.elements.editTxTitle.value = tx.title;
    CurrencyInputMask.setFormattedValue(this.elements.editTxAmount, tx.amount);
    
    // Populate Edit Category & Account Selects
    let catHtml = '';
    this.bm.getCategories().forEach(c => {
      catHtml += `<option value="${this.escapeHtml(c)}" ${c === tx.category ? 'selected' : ''}>${this.escapeHtml(c)}</option>`;
    });
    this.elements.editTxCategory.innerHTML = catHtml;

    let accHtml = '';
    this.bm.getAccounts().forEach(a => {
      accHtml += `<option value="${this.escapeHtml(a)}" ${a === tx.account ? 'selected' : ''}>${this.escapeHtml(a)}</option>`;
    });
    this.elements.editTxAccount.innerHTML = accHtml;

    const isoDate = tx.date ? new Date(tx.date).toISOString().split('T')[0] : '';
    this.elements.editTxDate.value = isoDate;

    const radio = document.querySelector(`input[name="edit-tx-type"][value="${tx.type}"]`);
    if (radio) radio.checked = true;

    this.elements.modalEditTx.classList.remove('hidden');
    setTimeout(() => this.elements.editTxTitle.focus(), 100);
  }

  closeEditTxModal() {
    this.elements.modalEditTx.classList.add('hidden');
  }

  async handleEditTxSubmit(e) {
    e.preventDefault();
    const id = this.elements.editTxId.value;
    const type = document.querySelector('input[name="edit-tx-type"]:checked').value;
    const title = this.elements.editTxTitle.value.trim();
    const amount = CurrencyInputMask.getRawNumber(this.elements.editTxAmount);
    const category = this.elements.editTxCategory.value;
    const account = this.elements.editTxAccount.value;
    const date = this.elements.editTxDate.value;

    if (!title || amount <= 0) {
      this.showToast('Harap lengkapi judul dan nominal yang valid!', 'danger');
      return;
    }

    try {
      await this.bm.updateTransaction(id, { type, title, amount, category, account, date });
      this.closeEditTxModal();
      this.showToast(`Transaksi "${title}" berhasil diperbarui! ✏️`, 'success');
      this.render();
    } catch (err) {
      this.showToast(err.message, 'danger');
    }
  }

  // ==========================================
  // DYNAMIC DROPDOWNS POPULATION
  // ==========================================

  populateDropdowns() {
    if (!this.bm) return;

    // 1. Transaction Modal Categories
    if (this.elements.txCategorySelect) {
      let html = '';
      this.bm.getCategories().forEach(c => {
        html += `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`;
      });
      html += `<option value="__add_new__" style="color: #818cf8; font-weight: bold;">➕ Tambah Kategori Baru...</option>`;
      this.elements.txCategorySelect.innerHTML = html;
    }

    // 2. Transaction Modal Accounts
    if (this.elements.txAccountSelect) {
      let html = '';
      this.bm.getAccounts().forEach(a => {
        html += `<option value="${this.escapeHtml(a)}">${this.escapeHtml(a)}</option>`;
      });
      html += `<option value="__add_new__" style="color: #818cf8; font-weight: bold;">➕ Tambah Rekening Baru...</option>`;
      this.elements.txAccountSelect.innerHTML = html;
    }

    // 3. Goal Form Categories
    if (this.elements.goalCategoryInput) {
      let html = '';
      this.bm.getCategories().forEach(c => {
        html += `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`;
      });
      this.elements.goalCategoryInput.innerHTML = html;
    }

    // 4. Excel Filter Toolbar
    if (this.elements.excelCatFilter) {
      const cur = this.elements.excelCatFilter.value;
      let html = '<option value="all">Semua Kategori</option>';
      this.bm.getCategories().forEach(c => {
        html += `<option value="${this.escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${this.escapeHtml(c)}</option>`;
      });
      this.elements.excelCatFilter.innerHTML = html;
    }

    if (this.elements.excelAccFilter) {
      const cur = this.elements.excelAccFilter.value;
      let html = '<option value="all">Semua Rekening/Metode</option>';
      this.bm.getAccounts().forEach(a => {
        html += `<option value="${this.escapeHtml(a)}" ${a === cur ? 'selected' : ''}>${this.escapeHtml(a)}</option>`;
      });
      this.elements.excelAccFilter.innerHTML = html;
    }
  }

  // ==========================================
  // RENDER MASTER & COMPONENTS
  // ==========================================

  render() {
    if (!this.bm) return;
    this.populateDropdowns();
    this.renderOverview();
    this.renderGoals();
    this.renderRecentTransactions();
    this.renderSurplusLedger();

    if (this.activeView === 'transactions') {
      this.renderCashflowChart();
      if (this.txViewMode === 'calendar') {
        this.renderCalendar();
        this.renderCalendarDayDetail(this.selectedCalDate);
      } else {
        this.renderExcelTable();
      }
    } else if (this.activeView === 'settings') {
      this.renderSettings();
    }
  }

  renderOverview() {
    const netBalance = this.bm.getNetBalance();
    const totalIncome = this.bm.getTotalIncome();
    const totalExpense = this.bm.getTotalExpense();
    const goalsCollected = this.bm.getTotalGoalsCollected();
    const goalsTarget = this.bm.getTotalGoalsTarget();
    const overallPct = this.bm.getOverallProgressPercentage();

    if (this.elements.valBalance) this.elements.valBalance.textContent = UIManager.formatCurrency(netBalance);
    if (this.elements.valIncome) this.elements.valIncome.textContent = UIManager.formatCurrency(totalIncome);
    if (this.elements.valExpense) this.elements.valExpense.textContent = UIManager.formatCurrency(totalExpense);
    if (this.elements.valGoalsCollected) this.elements.valGoalsCollected.textContent = UIManager.formatCurrency(goalsCollected);
    if (this.elements.valGoalsTarget) this.elements.valGoalsTarget.textContent = UIManager.formatCurrency(goalsTarget);
    if (this.elements.valGoalsPct) this.elements.valGoalsPct.textContent = `${overallPct}%`;

    if (this.elements.overallPctLabel) this.elements.overallPctLabel.textContent = `${overallPct}%`;
    if (this.elements.overallProgressBar) this.elements.overallProgressBar.style.width = `${overallPct}%`;
  }

  renderGoals() {
    if (!this.elements.goalsContainer) return;
    const filteredGoals = this.bm.getFilteredGoals(this.currentGoalFilter);
    this.elements.goalsContainer.innerHTML = '';

    if (filteredGoals.length === 0) {
      this.elements.goalsEmptyState.classList.remove('hidden');
      return;
    }

    this.elements.goalsEmptyState.classList.add('hidden');

    filteredGoals.forEach(goal => {
      const card = this.createGoalCardElement(goal);
      this.elements.goalsContainer.appendChild(card);
    });
  }

  createGoalCardElement(goal) {
    const card = document.createElement('div');
    card.className = `goal-item-card ${goal.isCompleted() ? 'is-completed' : ''}`;

    const pct = goal.getProgressPercentage();
    const colorClass = goal.getProgressColorClass();
    const isDone = goal.isCompleted();

    card.innerHTML = `
      <div class="goal-header">
        <div class="goal-title-wrap">
          <h4 class="goal-title">${this.escapeHtml(goal.title)}</h4>
          <div class="goal-badges">
            <span class="badge badge-category">${this.escapeHtml(goal.category)}</span>
            ${isDone ? '<span class="badge badge-completed">🎉 Tercapai!</span>' : ''}
          </div>
        </div>
      </div>

      <div class="goal-finance-detail">
        <div class="goal-amounts">
          <div>
            <div class="goal-current">${UIManager.formatCurrency(goal.currentAmount)}</div>
            <div class="goal-target">Target: ${UIManager.formatCurrency(goal.targetAmount)}</div>
          </div>
          <div class="goal-progress-meta">
            <strong>${pct}%</strong>
          </div>
        </div>

        <div class="progress-track">
          <div class="progress-fill ${colorClass}" style="width: ${pct}%;"></div>
        </div>

        <div class="goal-progress-meta">
          <span>${isDone ? 'Semua dana terkumpul' : `Sisa: ${UIManager.formatCurrency(goal.getRemainingAmount())}`}</span>
          ${goal.deadline ? `<span class="goal-deadline-info">📅 ${UIManager.formatDate(goal.deadline)}</span>` : ''}
        </div>
      </div>

      <div class="goal-actions">
        <button class="btn btn-secondary btn-sm btn-deposit" ${isDone ? 'disabled title="Goal sudah tercapai!"' : ''}>
          <span>💵</span> Nabung
        </button>
        <button class="btn btn-danger-outline btn-sm btn-delete" title="Hapus target ini">
          <span>🗑️</span> Hapus
        </button>
      </div>
    `;

    const depositBtn = card.querySelector('.btn-deposit');
    if (depositBtn && !isDone) {
      depositBtn.addEventListener('click', () => this.openDepositModal(goal.id));
    }

    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Apakah Anda yakin ingin menghapus target "${goal.title}"?`)) {
          try {
            await this.bm.deleteGoal(goal.id);
            this.showToast(`Target "${goal.title}" telah dihapus.`, 'info');
            this.render();
          } catch (err) { this.showToast(err.message, 'danger'); }
        }
      });
    }

    return card;
  }

  renderRecentTransactions() {
    if (!this.elements.txContainer) return;
    const recentTx = this.bm.getRecentTransactions(5);
    this.elements.txContainer.innerHTML = '';
    if (this.elements.txCountBadge) {
      this.elements.txCountBadge.textContent = `${this.bm.transactions.length} Transaksi`;
    }

    if (recentTx.length === 0) {
      this.elements.txContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">Belum ada aktivitas transaksi.</div>';
      return;
    }

    recentTx.forEach(tx => {
      const item = document.createElement('div');
      item.className = `tx-item ${tx.type}`;

      const isInc = tx.type === 'income';
      const sign = isInc ? '+' : '-';
      const amountClass = isInc ? 'income' : 'expense';

      item.innerHTML = `
        <div class="tx-info">
          <span class="tx-title">${this.escapeHtml(tx.title)}</span>
          <span class="tx-meta">${this.escapeHtml(tx.category)} &bull; ${this.escapeHtml(tx.account || 'Cash')} &bull; ${UIManager.formatDate(tx.date)}</span>
        </div>
        <div class="tx-amount ${amountClass}">
          ${sign} ${UIManager.formatCurrency(tx.amount)}
        </div>
      `;

      this.elements.txContainer.appendChild(item);
    });
  }

  renderSurplusLedger() {
    const s = this.bm.getSurplusDetails();

    if (this.elements.surplusValue) {
      this.elements.surplusValue.textContent = UIManager.formatCurrency(Math.abs(s.netSurplus));
      this.elements.surplusValue.className = `surplus-amount ${s.isSurplus ? 'text-success' : 'text-danger'}`;
    }

    if (this.elements.surplusStatusBadge) {
      if (s.isSurplus) {
        this.elements.surplusStatusBadge.className = 'badge badge-surplus-positive';
        this.elements.surplusStatusBadge.textContent = '🟢 SURPLUS BERSIH (Aman)';
      } else {
        this.elements.surplusStatusBadge.className = 'badge badge-surplus-negative';
        this.elements.surplusStatusBadge.textContent = '🔴 DEFISIT BERSIH (Pengeluaran Melebihi)';
      }
    }

    if (this.elements.ledgerTotalIncome) {
      this.elements.ledgerTotalIncome.textContent = UIManager.formatCurrency(s.totalIncome);
    }
    if (this.elements.ledgerTotalExpense) {
      this.elements.ledgerTotalExpense.textContent = UIManager.formatCurrency(s.totalExpense);
    }
    if (this.elements.ledgerSavingRate) {
      this.elements.ledgerSavingRate.textContent = `${s.percentageSurplus}%`;
    }
  }

  renderCashflowChart() {
    if (!this.elements.chartCanvas) return;
    if (typeof Chart === 'undefined') return;

    const timeline = this.bm.getCashFlowTimeline(this.currentTimeframe);

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    if (!timeline.hasData || timeline.labels.length === 0) {
      if (this.elements.chartEmptyPlaceholder) {
        this.elements.chartEmptyPlaceholder.classList.remove('hidden');
      }
      this.elements.chartCanvas.style.display = 'none';
      return;
    }

    if (this.elements.chartEmptyPlaceholder) {
      this.elements.chartEmptyPlaceholder.classList.add('hidden');
    }
    this.elements.chartCanvas.style.display = 'block';

    const ctx = this.elements.chartCanvas.getContext('2d');

    const gradIncome = ctx.createLinearGradient(0, 0, 0, 260);
    gradIncome.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    gradIncome.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const gradExpense = ctx.createLinearGradient(0, 0, 0, 260);
    gradExpense.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    gradExpense.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeline.labels,
        datasets: [
          {
            label: 'Pemasukan (Income)',
            data: timeline.incomeData,
            borderColor: '#10b981',
            backgroundColor: gradIncome,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Pengeluaran (Expense)',
            data: timeline.expenseData,
            borderColor: '#ef4444',
            backgroundColor: gradExpense,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#ef4444',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                return ` ${label}: ${UIManager.formatCurrency(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (value) => {
                if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)} jt`;
                if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)} rb`;
                return `Rp ${value}`;
              }
            }
          }
        }
      }
    });
  }

  // ==========================================
  // GOOGLE CALENDAR VIEW
  // ==========================================

  renderCalendar() {
    if (!this.elements.calendarDaysGrid) return;

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    if (this.elements.calMonthLabel) {
      this.elements.calMonthLabel.textContent = `${monthNames[this.calMonth]} ${this.calYear}`;
    }

    const monthAggregates = this.bm.getCalendarMonthData(this.calYear, this.calMonth);

    const firstDayIndex = new Date(this.calYear, this.calMonth, 1).getDay();
    const daysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.calYear, this.calMonth, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    this.elements.calendarDaysGrid.innerHTML = '';

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDateNum = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell cal-day-outside';
      cell.innerHTML = `<span class="cal-day-num">${prevDateNum}</span>`;
      this.elements.calendarDaysGrid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(this.calMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const isoDate = `${this.calYear}-${monthStr}-${dayStr}`;

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      if (isoDate === todayStr) cell.classList.add('is-today');
      if (isoDate === this.selectedCalDate) cell.classList.add('is-selected');

      const data = monthAggregates.get(isoDate);

      let eventsHtml = '';
      if (data && data.count > 0) {
        if (data.income > 0) {
          eventsHtml += `<div class="cal-event-pill cal-pill-income">+${UIManager.formatCurrency(data.income)}</div>`;
        }
        if (data.expense > 0) {
          eventsHtml += `<div class="cal-event-pill cal-pill-expense">-${UIManager.formatCurrency(data.expense)}</div>`;
        }
      }

      cell.innerHTML = `
        <div class="cal-day-header">
          <span class="cal-day-num">${d}</span>
          ${data && data.count > 0 ? `<span class="cal-badge-count">${data.count}</span>` : ''}
        </div>
        <div class="cal-day-events">${eventsHtml}</div>
      `;

      cell.addEventListener('click', () => {
        document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        this.selectedCalDate = isoDate;
        this.renderCalendarDayDetail(isoDate);
      });

      this.elements.calendarDaysGrid.appendChild(cell);
    }

    const totalCellsRendered = firstDayIndex + daysInMonth;
    const remainingCells = (7 - (totalCellsRendered % 7)) % 7;
    for (let j = 1; j <= remainingCells; j++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell cal-day-outside';
      cell.innerHTML = `<span class="cal-day-num">${j}</span>`;
      this.elements.calendarDaysGrid.appendChild(cell);
    }
  }

  renderCalendarDayDetail(isoDate) {
    if (!this.elements.dayDetailTxList) return;

    const dayTx = this.bm.getTransactionsForDay(isoDate);

    if (this.elements.dayDetailDateLabel) {
      this.elements.dayDetailDateLabel.textContent = UIManager.formatDate(isoDate);
    }

    if (this.elements.btnOpenTxModalCal) {
      this.elements.btnOpenTxModalCal.onclick = () => this.openTxModal(isoDate);
    }

    let dayIncome = 0;
    let dayExpense = 0;

    this.elements.dayDetailTxList.innerHTML = '';

    if (dayTx.length === 0) {
      if (this.elements.dayDetailEmptyState) {
        this.elements.dayDetailEmptyState.classList.remove('hidden');
      }
      if (this.elements.dayDetailIncomeBadge) this.elements.dayDetailIncomeBadge.textContent = '+ Rp 0';
      if (this.elements.dayDetailExpenseBadge) this.elements.dayDetailExpenseBadge.textContent = '- Rp 0';
      return;
    }

    if (this.elements.dayDetailEmptyState) {
      this.elements.dayDetailEmptyState.classList.add('hidden');
    }

    dayTx.forEach(tx => {
      if (tx.isIncome()) dayIncome += tx.amount;
      else dayExpense += tx.amount;

      const item = document.createElement('div');
      item.className = `cal-detail-item ${tx.type}`;

      const isInc = tx.type === 'income';
      const sign = isInc ? '+' : '-';
      const amountClass = isInc ? 'text-success' : 'text-danger';

      let timeStr = '00:00';
      try {
        const d = new Date(tx.date);
        timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      } catch {}

      item.innerHTML = `
        <div class="cal-item-time">${timeStr}</div>
        <div class="cal-item-info">
          <div class="cal-item-title">${this.escapeHtml(tx.title)}</div>
          <div class="cal-item-meta">
            <span class="badge badge-category">${this.escapeHtml(tx.category)}</span>
            <span class="badge badge-account">${this.escapeHtml(tx.account || 'Cash')}</span>
            <span>&bull; ${tx.type === 'income' ? 'Pemasukan' : (tx.type === 'goal_saving' ? 'Tabungan Goal' : 'Pengeluaran')}</span>
          </div>
        </div>
        <div class="cal-item-amt ${amountClass} font-mono">
          <strong>${sign} ${UIManager.formatCurrency(tx.amount)}</strong>
        </div>
        <div class="cal-item-actions">
          <button class="btn-icon btn-edit-tx" title="Edit Transaksi">✏️</button>
          <button class="btn-icon btn-del-tx" title="Hapus Transaksi">🗑️</button>
        </div>
      `;

      item.querySelector('.btn-edit-tx').addEventListener('click', () => this.openEditTxModal(tx.id));
      item.querySelector('.btn-del-tx').addEventListener('click', async () => {
        if (confirm(`Yakin ingin menghapus transaksi "${tx.title}"?`)) {
          try {
            await this.bm.deleteTransaction(tx.id);
            this.showToast(`Transaksi "${tx.title}" telah dihapus.`, 'info');
            this.render();
          } catch (err) { this.showToast(err.message, 'danger'); }
        }
      });

      this.elements.dayDetailTxList.appendChild(item);
    });

    if (this.elements.dayDetailIncomeBadge) {
      this.elements.dayDetailIncomeBadge.textContent = `+ ${UIManager.formatCurrency(dayIncome)}`;
    }
    if (this.elements.dayDetailExpenseBadge) {
      this.elements.dayDetailExpenseBadge.textContent = `- ${UIManager.formatCurrency(dayExpense)}`;
    }
  }

  // ==========================================
  // EXCEL SPREADSHEET TABLE
  // ==========================================

  renderExcelTable() {
    if (!this.elements.excelTableBody) return;

    const filtered = this.bm.getFilteredTransactions({
      type: this.currentTxTypeFilter,
      searchQuery: this.currentTxSearch,
      category: this.currentTxCategoryFilter,
      account: this.currentTxAccountFilter
    });

    this.elements.excelTableBody.innerHTML = '';
    if (this.elements.excelCountBadge) {
      this.elements.excelCountBadge.textContent = `${filtered.length} Transaksi`;
    }

    if (filtered.length === 0) {
      this.elements.excelEmptyState.classList.remove('hidden');
      this.updateExcelFooters(0, 0, 0);
      return;
    }

    this.elements.excelEmptyState.classList.add('hidden');

    let subIncome = 0;
    let subExpense = 0;

    filtered.forEach((tx, idx) => {
      if (tx.isIncome()) subIncome += tx.amount;
      else subExpense += tx.amount;

      const tr = document.createElement('tr');
      tr.className = `excel-row ${tx.type}`;

      const isInc = tx.type === 'income';
      const sign = isInc ? '+' : '-';
      const amountClass = isInc ? 'text-success' : 'text-danger';

      let typeBadge = '';
      if (tx.type === 'income') {
        typeBadge = '<span class="badge badge-excel-income">📈 Pemasukan</span>';
      } else if (tx.type === 'goal_saving') {
        typeBadge = '<span class="badge badge-excel-goal">🎯 Tabungan Goal</span>';
      } else {
        typeBadge = '<span class="badge badge-excel-expense">📉 Pengeluaran</span>';
      }

      tr.innerHTML = `
        <td class="excel-cell text-center text-muted">${idx + 1}</td>
        <td class="excel-cell text-nowrap">${UIManager.formatDate(tx.date, true)}</td>
        <td class="excel-cell font-weight-bold">
          <div class="excel-title-cell">${this.escapeHtml(tx.title)}</div>
        </td>
        <td class="excel-cell"><span class="badge badge-category">${this.escapeHtml(tx.category)}</span></td>
        <td class="excel-cell"><span class="badge badge-account">${this.escapeHtml(tx.account || 'Cash')}</span></td>
        <td class="excel-cell">${typeBadge}</td>
        <td class="excel-cell text-right ${amountClass} font-mono">
          <strong>${sign} ${UIManager.formatCurrency(tx.amount)}</strong>
        </td>
        <td class="excel-cell text-center text-nowrap">
          <button class="btn-icon btn-edit-tx" data-id="${tx.id}" title="Edit Transaksi">✏️</button>
          <button class="btn-icon btn-del-tx" data-id="${tx.id}" title="Hapus Transaksi">🗑️</button>
        </td>
      `;

      tr.querySelector('.btn-edit-tx').addEventListener('click', () => this.openEditTxModal(tx.id));
      tr.querySelector('.btn-del-tx').addEventListener('click', async () => {
        if (confirm(`Yakin ingin menghapus transaksi "${tx.title}"?`)) {
          try {
            await this.bm.deleteTransaction(tx.id);
            this.showToast(`Transaksi "${tx.title}" telah dihapus.`, 'info');
            this.render();
          } catch (err) { this.showToast(err.message, 'danger'); }
        }
      });

      this.elements.excelTableBody.appendChild(tr);
    });

    const subSurplus = subIncome - subExpense;
    this.updateExcelFooters(subIncome, subExpense, subSurplus);
  }

  updateExcelFooters(income, expense, surplus) {
    if (this.elements.excelFootIncome) {
      this.elements.excelFootIncome.textContent = `+ ${UIManager.formatCurrency(income)}`;
    }
    if (this.elements.excelFootExpense) {
      this.elements.excelFootExpense.textContent = `- ${UIManager.formatCurrency(expense)}`;
    }
    if (this.elements.excelFootSurplus) {
      this.elements.excelFootSurplus.textContent = `${surplus >= 0 ? '+' : '-'} ${UIManager.formatCurrency(Math.abs(surplus))}`;
      this.elements.excelFootSurplus.className = surplus >= 0 ? 'text-success' : 'text-danger';
    }
  }

  // ==========================================
  // SETTINGS SECTION: CATEGORIES & ACCOUNTS
  // ==========================================

  renderSettings() {
    if (!this.bm) return;

    // 1. Render Categories List
    if (this.elements.categoryListContainer) {
      this.elements.categoryListContainer.innerHTML = '';
      this.bm.getCategories().forEach(cat => {
        const item = document.createElement('div');
        item.className = 'settings-item-pill';
        item.innerHTML = `
          <span>🏷️ ${this.escapeHtml(cat)}</span>
          <button class="btn-item-del" title="Hapus Kategori">&times;</button>
        `;
        item.querySelector('.btn-item-del').addEventListener('click', async () => {
          if (confirm(`Hapus kategori "${cat}"?`)) {
            try {
              await this.bm.deleteCategory(cat);
              this.showToast(`Kategori "${cat}" dihapus.`, 'info');
              this.renderSettings();
              this.populateDropdowns();
            } catch (err) {
              this.showToast(err.message, 'danger');
            }
          }
        });
        this.elements.categoryListContainer.appendChild(item);
      });
    }

    // 2. Render Accounts List
    if (this.elements.accountListContainer) {
      this.elements.accountListContainer.innerHTML = '';
      this.bm.getAccounts().forEach(acc => {
        const item = document.createElement('div');
        item.className = 'settings-item-pill';
        item.innerHTML = `
          <span>💳 ${this.escapeHtml(acc)}</span>
          <button class="btn-item-del" title="Hapus Rekening">&times;</button>
        `;
        item.querySelector('.btn-item-del').addEventListener('click', async () => {
          if (confirm(`Hapus rekening/metode "${acc}"?`)) {
            try {
              await this.bm.deleteAccount(acc);
              this.showToast(`Rekening/Metode "${acc}" dihapus.`, 'info');
              this.renderSettings();
              this.populateDropdowns();
            } catch (err) {
              this.showToast(err.message, 'danger');
            }
          }
        });
        this.elements.accountListContainer.appendChild(item);
      });
    }
  }

  showToast(message, type = 'info') {
    if (!this.elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
