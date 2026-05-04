import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Account } from '../db/models';
import {
  computeCreditCardOutstandingThisCycle,
  CreditCardBreakdown,
} from '../utils/cardBilling';
import type { RootStore } from './index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditCardSummary extends CreditCardBreakdown {
  card: Account;
  cycleStart: Date;
  cycleEnd: Date;
  nextDue: Date;
  daysUntilDue: number;
  isOverdue: boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class AccountStore {
  accounts: Account[] = [];
  loading = false;
  error: string | null = null;

  private root: RootStore;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false }); // root is a static ref — don't observe it
  }

  // ── Load ──────────────────────────────────────────────────────────────────

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

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async addAccount(data: {
    name: string; type: string; bankName: string;
    cardLast2?: string; cardType?: string; creditLimit?: number;
    currentBalance: number; billDate?: number; dueDate?: number;
  }) {
    await db.accounts.database.write(async () => {
      await db.accounts.create((acc: any) => {
        acc.name            = data.name;
        acc.type            = data.type;
        acc.bankName        = data.bankName;
        acc.cardLast2       = data.cardLast2   ?? null;
        acc.cardType        = data.cardType    ?? null;
        acc.creditLimit     = data.creditLimit ?? null;
        acc.currentBalance  = data.type === 'credit' ? 0 : data.currentBalance;
        acc.billDate        = data.billDate    ?? null;
        acc.dueDate         = data.dueDate     ?? null;
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
        if (data.name           !== undefined) _acc.name           = data.name;
        if (data.bankName       !== undefined) _acc.bankName       = data.bankName;
        if (data.cardLast2      !== undefined) _acc.cardLast2      = data.cardLast2;
        if (data.cardType       !== undefined) _acc.cardType       = data.cardType;
        if (data.creditLimit    !== undefined) _acc.creditLimit    = data.creditLimit;
        if (data.currentBalance !== undefined && acc.type !== 'credit') {
          _acc.currentBalance = data.currentBalance; // debit only
        }
        if (data.billDate       !== undefined) _acc.billDate       = data.billDate;
        if (data.dueDate        !== undefined) _acc.dueDate        = data.dueDate;
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

  // ── Computed views ────────────────────────────────────────────────────────

  get debitAccounts() { return this.accounts.filter(a => a.type === 'debit'); }
  get creditCards()   { return this.accounts.filter(a => a.type === 'credit'); }

  get totalLiquid(): number {
    return this.debitAccounts.reduce((s, a) => s + a.currentBalance, 0);
  }

  /**
   * Full billing breakdown for every credit card that has billDate + dueDate.
   * This is a MobX @computed — it auto-recomputes whenever transactions or
   * loans change, so no manual "recalculate" calls are needed anywhere.
   */
  get creditCardSummaries(): CreditCardSummary[] {
    const today = new Date();
    const txns  = this.root.budget.transactions;
    const loans = this.root.loans.loans;

    return this.creditCards
      .filter(c => c.billDate && c.dueDate)
      .map(card => {
        const cycleStart   = this.getCycleStart(card.billDate!);
        const cycleEnd     = this.getNextBillDate(card.billDate!);
        const nextDue      = this.getNextDueDate(card.billDate!, card.dueDate!);
        const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / 86_400_000);

        const cardTxns  = txns.filter(t => t.accountId === card.id);
        const cardLoans = loans.filter(l => l.accountId === card.id);

        const breakdown = computeCreditCardOutstandingThisCycle(
          cycleStart.getTime(),
          cycleEnd.getTime(),
          cardTxns.map(t => ({ amount: t.amount, date: t.date, subCategory: t.subCategory })),
          cardLoans.map(l => ({
            principal:    l.principal,
            roi:          l.roi,
            tenureMonths: l.tenureMonths,
            paidEmis:     l.paidEmis,
            startDate:    l.startDate,  // ← always included
            emiDay:       l.emiDay,     // ← always included
          })),
        );

        return {
          card,
          cycleStart,
          cycleEnd,
          nextDue,
          daysUntilDue,
          isOverdue: !breakdown.isPaid && daysUntilDue < 0,
          ...breakdown,
        };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  /** Total outstanding across all credit cards (computed, never stored). */
  get totalCreditOutstanding(): number {
    return this.creditCardSummaries.reduce((s, cs) => s + cs.totalOutstanding, 0);
  }

  /** @deprecated Use totalCreditOutstanding. */
  get totalCreditUsed(): number { return this.totalCreditOutstanding; }

  // ── Pure date helpers (stateless, no DB) ──────────────────────────────────

  /** Start of the current billing cycle (the day the last bill was generated). */
  getCycleStart(billDay: number): Date {
    const today = new Date();
    if (today.getDate() >= billDay) {
      return new Date(today.getFullYear(), today.getMonth(), billDay);
    }
    return new Date(today.getFullYear(), today.getMonth() - 1, billDay);
  }

  /** Date when the NEXT bill will be generated. */
  getNextBillDate(billDay: number): Date {
    const today = new Date();
    if (today.getDate() < billDay) {
      return new Date(today.getFullYear(), today.getMonth(), billDay);
    }
    return new Date(today.getFullYear(), today.getMonth() + 1, billDay);
  }

  /** Date when payment is due for the current bill. */
  getNextDueDate(billDay: number, dueDay: number): Date {
    const cycleStart = this.getCycleStart(billDay);
    return new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, dueDay);
  }

  /** Days until next bill or due date. */
  daysUntilBill(billDay: number, dueDay?: number): number {
    const next = dueDay
      ? this.getNextDueDate(billDay, dueDay)
      : this.getNextBillDate(billDay);
    return Math.ceil((next.getTime() - new Date().getTime()) / 86_400_000);
  }

  /** @deprecated — cycle is now always computed from billDate. */
  getStatementCycleStart(acc: Pick<Account, 'billDate' | 'lastPaidCycleStart'>): Date {
    if (acc.billDate != null) {
      return this.getCycleStart(acc.billDate as number);
    }
    return acc.lastPaidCycleStart ? new Date(acc.lastPaidCycleStart as Date) : new Date(0);
  }
}
