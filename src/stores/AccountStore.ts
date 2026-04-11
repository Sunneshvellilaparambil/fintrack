import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Account } from '../db/models';

export class AccountStore {
  accounts: Account[] = [];
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    try {
      runInAction(() => { this.loading = true; });
      const result = await db.accounts.query().fetch();
      runInAction(() => {
        this.accounts = result;
        this.loading = false;
      });
    } catch (e: any) {
      runInAction(() => { this.error = e.message; this.loading = false; });
    }
  }

  async addAccount(data: {
    name: string; type: string; bankName: string;
    cardLast2?: string; cardType?: string; creditLimit?: number;
    currentBalance: number;
  }) {
    await db.accounts.database.write(async () => {
      await db.accounts.create(acc => {
        acc.name = data.name;
        (acc as any).type = data.type;
        (acc as any).bankName = data.bankName;
        (acc as any).cardLast2 = data.cardLast2 ?? null;
        (acc as any).cardType = data.cardType ?? null;
        (acc as any).creditLimit = data.creditLimit ?? null;
        (acc as any).currentBalance = data.currentBalance;
      });
    });
    await this.load();
  }

  async deleteAccount(id: string) {
    await db.accounts.database.write(async () => {
      const acc = await db.accounts.find(id);
      await acc.destroyPermanently();
    });
    await this.load();
  }

  get debitAccounts() { return this.accounts.filter(a => a.type === 'debit'); }
  get creditCards() { return this.accounts.filter(a => a.type === 'credit'); }

  get totalLiquid() {
    return this.debitAccounts.reduce((s, a) => s + a.currentBalance, 0);
  }

  get totalCreditUsed() {
    return this.accounts
      .filter(a => a.type === 'credit')
      .reduce((s, a) => s + a.currentBalance, 0);
  }
}
