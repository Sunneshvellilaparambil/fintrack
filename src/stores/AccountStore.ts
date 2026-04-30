import { makeAutoObservable, runInAction } from 'mobx';
import { Q } from '@nozbe/watermelondb';
import { db } from '../db';
import { Account } from '../db/models';
import { calculateEMI } from '../utils/finance';

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
    currentBalance: number; billDate?: number; dueDate?: number;
  }) {
    await db.accounts.database.write(async () => {
      await db.accounts.create((acc: any) => {
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
    currentBalance?: number; billDate?: number; dueDate?: number;
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
        if (data.billDate !== undefined) _acc.billDate = data.billDate;
        if (data.dueDate !== undefined) _acc.dueDate = data.dueDate;
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
      await acc.update((_acc: any) => {
        _acc.currentBalance += delta;
      });
    });
    await this.load();
  }

  async recalculateCardBalance(id: string) {
    await db.accounts.database.write(async () => {
      const acc = await db.accounts.find(id) as any;
      if (acc.type !== 'credit') return;

      const cycleStart = acc.lastPaidCycleStart ? new Date(acc.lastPaidCycleStart) : new Date(0);

      const cardLoans = await db.loans.query(Q.where('account_id', id)).fetch() as any[];
      let totalEmiBurden = 0;
      for (const loan of cardLoans) {
        const remaining = loan.tenureMonths - loan.paidEmis;
        if (remaining > 0) {
          totalEmiBurden += remaining * calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
        }
      }

      const txns = await db.transactions.query(
        Q.where('account_id', id),
        Q.where('date', Q.gte(cycleStart.getTime()))
      ).fetch() as any[];
      
      let unpaidPurchases = 0;
      for (const t of txns) {
        unpaidPurchases -= t.amount;
      }
      unpaidPurchases = Math.max(0, unpaidPurchases);

      await acc.update((_acc: any) => {
        _acc.currentBalance = unpaidPurchases + totalEmiBurden;
      });
    });
    await this.load();
  }

  async markBillAsPaid(id: string) {
    await db.accounts.database.write(async () => {
      const acc = await db.accounts.find(id) as any;
      if (acc.billDate) {
        const cycleStart = this.getCycleStart(acc.billDate);
        
        // 1. Update lastPaidCycleStart
        await acc.update((_acc: any) => {
          _acc.lastPaidCycleStart = cycleStart;
        });

        // 2. Decrement remaining EMIs
        const cardLoans = await db.loans.query(Q.where('account_id', id)).fetch() as any[];
        
        for (const loan of cardLoans) {
          let paid = loan.paidEmis;
          if (paid < loan.tenureMonths) {
            paid += 1;
            await loan.update((l: any) => { l.paidEmis = paid; });
          }
        }
      }
    });
    // 3. Recalculate Current Balance
    await this.recalculateCardBalance(id);
  }

  // ── Credit Card Bill Cycle helpers (pure, no DB calls) ─────────────────

  /** Returns the start-of-cycle date (day the last bill was generated). */
  getCycleStart(billDay: number): Date {
    const today = new Date();
    if (today.getDate() >= billDay) {
      return new Date(today.getFullYear(), today.getMonth(), billDay);
    }
    return new Date(today.getFullYear(), today.getMonth() - 1, billDay);
  }

  /** Returns the next bill generation date. */
  getNextBillDate(billDay: number): Date {
    const today = new Date();
    if (today.getDate() < billDay) {
      return new Date(today.getFullYear(), today.getMonth(), billDay);
    }
    return new Date(today.getFullYear(), today.getMonth() + 1, billDay);
  }

  /** Returns the next payment due date based on the due day. */
  getNextDueDate(billDay: number, dueDay: number): Date {
    const billGenDate = this.getCycleStart(billDay);
    // Due date is in the NEXT month from the cycle start
    return new Date(billGenDate.getFullYear(), billGenDate.getMonth() + 1, dueDay);
  }

  /** Days until next bill generation or next payment if dueDate is provided. */
  daysUntilBill(billDay: number, dueDay?: number): number {
    const next = dueDay ? this.getNextDueDate(billDay, dueDay) : this.getNextBillDate(billDay);
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
