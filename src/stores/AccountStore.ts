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
    currentBalance: number; billDate?: Date; dueDate?: Date;
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
        (acc as any).billDate = data.billDate ?? null;
        (acc as any).dueDate = data.dueDate ?? null;
      });
    });
    await this.load();
  }

  async updateAccount(id: string, data: {
    name?: string; bankName?: string;
    cardLast2?: string; cardType?: string; creditLimit?: number;
    currentBalance?: number; billDate?: Date; dueDate?: Date;
  }) {
    await db.accounts.database.write(async () => {
      const acc = await db.accounts.find(id) as any;
      await acc.update((_acc: any) => {
        if (data.name !== undefined) _acc.name = data.name;
        if (data.bankName !== undefined) _acc.bankName = data.bankName;
        if (data.cardLast2 !== undefined) _acc.cardLast2 = data.cardLast2;
        if (data.cardType !== undefined) _acc.cardType = data.cardType;
        if (data.creditLimit !== undefined) _acc.creditLimit = data.creditLimit;
        if (data.currentBalance !== undefined) _acc.currentBalance = data.currentBalance;
        if (data.billDate !== undefined) _acc.billDate = (data.billDate as any);
        if (data.dueDate !== undefined) _acc.dueDate = (data.dueDate as any);
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

  async updateAccountBalance(id: string, delta: number) {
    await db.accounts.database.write(async () => {
      const acc = await db.accounts.find(id);
      await acc.update(_acc => {
        _acc.currentBalance += delta;
      });
    });
    await this.load();
  }

  // ── Credit Card Bill Cycle helpers (pure, no DB calls) ─────────────────

  /** Returns the start-of-cycle date (day the last bill was generated). */
  getCycleStart(billDate: Date): Date {
    const today = new Date();
    const day = billDate.getDate();
    if (today.getDate() >= day) {
      return new Date(today.getFullYear(), today.getMonth(), day);
    }
    return new Date(today.getFullYear(), today.getMonth() - 1, day);
  }

  /** Returns the next bill generation date. */
  getNextBillDate(billDate: Date): Date {
    const today = new Date();
    const day = billDate.getDate();
    if (today.getDate() < day) {
      return new Date(today.getFullYear(), today.getMonth(), day);
    }
    return new Date(today.getFullYear(), today.getMonth() + 1, day);
  }

  /** Returns the next payment due date based on the due day. */
  getNextDueDate(billDate: Date, dueDate: Date): Date {
    const today = new Date();
    const targetDueDay = dueDate.getDate();
    
    // Simple logic: if today's date is past the dueDay, the next due date is next month.
    if (today.getDate() < targetDueDay) {
      return new Date(today.getFullYear(), today.getMonth(), targetDueDay);
    }
    return new Date(today.getFullYear(), today.getMonth() + 1, targetDueDay);
  }

  /** Days until next bill generation or next payment if dueDate is provided. */
  daysUntilBill(billDate: Date, dueDate?: Date): number {
    const next = dueDate ? this.getNextDueDate(billDate, dueDate) : this.getNextBillDate(billDate);
    return Math.ceil((next.getTime() - new Date().getTime()) / 86400000);
  }

  // ── Computed ───────────────────────────────────────────────────────────

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
