/**
 * SmartBudget Main Application Bootstrap
 * Connects AuthManager -> UIManager -> BudgetManager (per-user)
 */
class BudgetApp {
  constructor() {
    this.authManager = new AuthManager();
    this.ui = new UIManager(this.authManager);
  }

  start() {
    this.ui.init();
    console.log('✅ SmartBudget OOP Application initialized with Multi-User Auth & Settings.');
  }
}

// Bootstrap once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new BudgetApp();
  window.app.start();
});
