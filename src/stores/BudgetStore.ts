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
      // 1. Log transaction
      await db.transactions.create((t: any) => {
        t.accountId = data.accountId;
        t.amount = data.amount;
        t.category = data.category;
        t.subCategory = data.subCategory;
        t.note = data.note ?? null;
        t.date = data.date;
        t.isJointExpense = data.isJointExpense ?? false;
      });

      // 2. Adjust account balance
      try {
        const acc = await db.accounts.find(data.accountId) as any;
        if (acc) {
          await acc.update((_acc: any) => {
            // For credit cards: spending (negative amount) INCREASES the balance owed.
            // For debit: spending (negative amount) DECREASES the cash balance.
            _acc.currentBalance += (_acc.type === 'credit') ? -data.amount : data.amount;
          });
        }
      } catch (e) {
         // account not found
      }
    });

    await this.load();
  }

  async deleteTransaction(id: string) {
    await db.transactions.database.write(async () => {
      const t = await db.transactions.find(id) as any;
      const amount = t.amount;
      const accountId = t.accountId;

      // 1. Revert balance
      try {
        const acc = await db.accounts.find(accountId) as any;
        if (acc) {
          await acc.update((_acc: any) => {
            // To REVERT a transaction: 
            // If it was a debit expense (amount < 0), we ADD back the absolute amount.
            // If it was a credit card spend (amount < 0), it INCREASED debt, so we SUBTRACT from balance.
            _acc.currentBalance += (_acc.type === 'credit') ? amount : -amount;
          });
        }
      } catch (e) {}

      // 2. Delete
      await t.destroyPermanently();
    });
    await this.load();
  }

  async updateTransaction(id: string, data: {
    accountId?: string; amount?: number; category?: string;
    subCategory?: string; note?: string; date?: Date;
  }) {
    await db.transactions.database.write(async () => {
      const t = await db.transactions.find(id) as any;
      const oldAmount = t.amount;
      const oldAccountId = t.accountId;

      // Revert old balance
      try {
        const oldAcc = await db.accounts.find(oldAccountId) as any;
        if (oldAcc) {
          await oldAcc.update((_acc: any) => {
            _acc.currentBalance += (_acc.type === 'credit') ? oldAmount : -oldAmount;
          });
        }
      } catch (e) {}

      // Update T
      await t.update((_t: any) => {
        if (data.accountId !== undefined) _t.accountId = data.accountId;
        if (data.amount !== undefined) _t.amount = data.amount;
        if (data.category !== undefined) _t.category = data.category;
        if (data.subCategory !== undefined) _t.subCategory = data.subCategory;
        if (data.note !== undefined) _t.note = data.note;
        if (data.date !== undefined) _t.date = data.date;
      });

      // Apply new balance
      const newAccountId = data.accountId || oldAccountId;
      const newAmount = data.amount !== undefined ? data.amount : oldAmount;
      try {
        const newAcc = await db.accounts.find(newAccountId) as any;
        if (newAcc) {
          await newAcc.update((_acc: any) => {
            _acc.currentBalance += (_acc.type === 'credit') ? -newAmount : newAmount;
          });
        }
      } catch (e) {}
    });
    await this.load();
  }

  async addIncomeSource(data: { name: string; amount: number; frequency: string; date: Date; accountId?: string }) {
    await db.incomeSources.database.write(async () => {
      await db.incomeSources.create((i: any) => {
        i.name = data.name;
        i.amount = data.amount;
        i.frequency = data.frequency;
        i.date = data.date;
      });

      if (data.accountId) {
        try {
          const acc = await db.accounts.find(data.accountId) as any;
          await acc.update((_acc: any) => {
            _acc.currentBalance += (_acc.type === 'credit') ? -data.amount : data.amount;
          });
        } catch (e) { }
      }
    });
    await this.load();
  }

  async updateIncomeSource(id: string, data: { name?: string; amount?: number; frequency?: string }) {
    await db.incomeSources.database.write(async () => {
      const i = await db.incomeSources.find(id) as any;
      await i.update((_i: any) => {
        if (data.name !== undefined) _i.name = data.name;
        if (data.amount !== undefined) _i.amount = data.amount;
        if (data.frequency !== undefined) _i.frequency = data.frequency;
      });
    });
    await this.load();
  }

  async deleteIncomeSource(id: string) {
    await db.incomeSources.database.write(async () => {
      const i = await db.incomeSources.find(id) as any;
      await i.destroyPermanently();
    });
    await this.load();
  }
}
