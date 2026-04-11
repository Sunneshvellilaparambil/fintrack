import { makeAutoObservable, runInAction, computed } from 'mobx';
import { db } from '../db';
import { Transaction, IncomeSource } from '../db/models';
import { computeBudget, BudgetAllocation } from '../utils/finance';

export class BudgetStore {
  transactions: Transaction[] = [];
  incomeSources: IncomeSource[] = [];
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    runInAction(() => { this.loading = true; });
    const [txns, income] = await Promise.all([
      db.transactions.query().fetch(),
      db.incomeSources.query().fetch(),
    ]);
    runInAction(() => {
      this.transactions = txns;
      this.incomeSources = income;
      this.loading = false;
    });
  }

  // Monthly income (recurring only)
  get monthlyIncome(): number {
    return this.incomeSources
      .filter(i => i.frequency === 'monthly')
      .reduce((s, i) => s + i.amount, 0);
  }

  // Spend this calendar month by category
  private spentThisMonth(category: string): number {
    const now = new Date();
    return this.transactions
      .filter(t => {
        const d = new Date(t.date);
        return (
          t.category === category &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear() &&
          t.amount < 0
        );
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  }

  get needsSpent() { return this.spentThisMonth('needs'); }
  get wantsSpent() { return this.spentThisMonth('wants'); }
  get savingsSpent() { return this.spentThisMonth('savings'); }

  get budget(): BudgetAllocation {
    return computeBudget(this.monthlyIncome, this.needsSpent, this.wantsSpent, this.savingsSpent);
  }

  async addTransaction(data: {
    accountId: string; amount: number; category: string;
    subCategory: string; note?: string; date: Date; isJointExpense?: boolean;
  }) {
    await db.transactions.database.write(async () => {
      await db.transactions.create(t => {
        (t as any).accountId = data.accountId;
        (t as any).amount = data.amount;
        (t as any).category = data.category;
        (t as any).subCategory = data.subCategory;
        (t as any).note = data.note ?? null;
        (t as any).date = data.date;
        (t as any).isJointExpense = data.isJointExpense ?? false;
      });
    });
    await this.load();
  }

  async addIncomeSource(data: { name: string; amount: number; frequency: string; date: Date }) {
    await db.incomeSources.database.write(async () => {
      await db.incomeSources.create(i => {
        (i as any).name = data.name;
        (i as any).amount = data.amount;
        (i as any).frequency = data.frequency;
        (i as any).date = data.date;
      });
    });
    await this.load();
  }
}
