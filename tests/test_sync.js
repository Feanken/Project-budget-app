const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, Date, Math, Intl });
for (const file of ['static/js/models/Goal.js', 'static/js/models/Transaction.js', 'static/js/services/BudgetManager.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
}
const BudgetManager = vm.runInContext('BudgetManager', context);

(async () => {
  const calls = [];
  const storage = {
    isHttpMode: true,
    goals: [], transactions: [{ id: '1', type: 'income', title: 'Gaji', amount: 100, date: '2026-01-01' }],
    getGoals() { return this.goals; }, getTransactions() { return this.transactions; },
    getCategories() { return ['Umum']; }, getAccounts() { return ['Tunai']; },
    async request(path, method, data) {
      calls.push({path, method, data});
      if (path === '/api/goals') {
        this.goals = [{id: '42', title: data.title, targetAmount: data.target_amount, currentAmount: data.current_amount}];
        return {id: 42};
      }
      if (path === '/api/goals/42/deposit') {
        this.goals[0].currentAmount += data.amount;
        return {};
      }
      throw new Error('Ditolak server');
    },
    async syncFromServer() {},
  };
  const manager = new BudgetManager(storage);
  const goal = await manager.addGoal({title: 'Liburan', targetAmount: 50, currentAmount: 10});
  assert.equal(goal.id, '42');
  assert.equal(calls.length, 1);
  const updated = await manager.depositToGoal('42', 10);
  assert.equal(updated.currentAmount, 20);
  assert.equal(calls.length, 2);
  await assert.rejects(manager.addTransaction({type: 'income', title: 'x', amount: 3}), /Ditolak/);
  assert.equal(manager.transactions.length, 1);
  console.log('Sinkronisasi server dan penanganan penolakan: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
