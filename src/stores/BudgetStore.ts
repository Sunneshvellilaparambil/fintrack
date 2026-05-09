import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Transaction, IncomeSource } from '../db/models';
import { computeBudget, BudgetAllocation, calculateEMI } from '../utils/finance';
import {
  CC_BILL_PAYMENT_SUBCATEGORY,
  ccBillTransferSubCategory,
  emiSubCategory,
} from '../utils/constants';
import { getNextEmiDueDate } from '../utils/cardBilling';
import type { RootStore } from './index';

export class BudgetStore {
  transactions: Transaction[]  = [];
  incomeSources: IncomeSource[] = [];
  loading = false;

  private root: RootStore;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  async load() {
    runInAction(() => { this.loading = true; });
    const [txns, income] = await Promise.all([
      db.transactions.query().fetch(),
      db.incomeSources.query().fetch(),
    ]);
    runInAction(() => {
      this.transactions  = txns;
      this.incomeSources = income;
      this.loading       = false;
    });
  }

  // ── Computed budget ───────────────────────────────────────────────────────

  get monthlyIncome(): number {
    return this.incomeSources
      .filter(i => i.frequency === 'monthly')
      .reduce((s, i) => s + i.amount, 0);
  }

  private spentThisMonth(category: string): number {
    const now = new Date();
    return this.transactions
      .filter(t => {
        const d = new Date(t.date);
        return (
          t.category === category &&
          d.getMonth()    === now.getMonth() &&
          d.getFullYear() === now.getFullYear() &&
          t.amount < 0
        );
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  }

  get needsSpent()   { return this.spentThisMonth('needs'); }
  get wantsSpent()   { return this.spentThisMonth('wants'); }
  get savingsSpent() { return this.spentThisMonth('savings'); }

  get budget(): BudgetAllocation {
    return computeBudget(
      this.monthlyIncome,
      this.needsSpent,
      this.wantsSpent,
      this.savingsSpent,
    );
  }

  // ── Transactions CRUD ─────────────────────────────────────────────────────

  async addTransaction(data: {
    accountId: string; amount: number; category: string;
    subCategory: string; note?: string; date: Date; isJointExpense?: boolean;
  }) {
    await db.transactions.database.write(async () => {
      // 1. Create transaction row
      await db.transactions.create((t: any) => {
        t.account.id     = data.accountId;   // ← WatermelonDB relation setter
        t.amount         = data.amount;
        t.category       = data.category;
        t.subCategory    = data.subCategory;
        t.note           = data.note ?? null;
        t.date           = data.date;
        t.isJointExpense = data.isJointExpense ?? false;
      });

      // 2. Debit accounts: update running balance atomically in the same write
      try {
        const acc = await db.accounts.find(data.accountId) as any;
        if (acc && acc.type !== 'credit') {
          await acc.update((_acc: any) => { _acc.currentBalance += data.amount; });
        }
        // Credit cards: no balance mutation — totalOutstanding is computed from transactions
      } catch { /* account not found */ }
    });

    await this.load();
  }

  /**
   * Pay a credit card bill from a debit/savings account.
   * Creates TWO transaction rows atomically:
   *   1. Debit account: -amount (cash out)
   *   2. Credit card:  +amount (payment received, sub_category = CC_BILL_PAYMENT_SUBCATEGORY)
   */
  async payCreditCardBill(data: {
    creditCardAccountId: string;
    fromDebitAccountId: string;
    amount: number;
    cardLabel: string;
    debitAccountName?: string;
    note?: string;
    date?: Date;
  }) {
    const amt = Math.abs(Number(data.amount));
    if (!(amt > 0) || !Number.isFinite(amt)) {
      throw new Error('Bill payment amount must be a positive number.');
    }
    // Hoist dt to method scope so we can reuse it for EMI bookkeeping entries
    const dt = data.date ?? new Date();

    await db.transactions.database.write(async () => {
      const cc    = await db.accounts.find(data.creditCardAccountId) as any;
      const debit = await db.accounts.find(data.fromDebitAccountId)  as any;

      if (cc.type !== 'credit' || debit.type === 'credit') {
        throw new Error('Need a credit card and a non-credit payer account.');
      }

      const fromName = data.debitAccountName ?? debit.name ?? 'Bank';

      // 1. Credit-card side: positive amount = payment received
      await db.transactions.create((t: any) => {
        t.account.id     = data.creditCardAccountId;
        t.amount         = amt;
        t.category       = 'needs';
        t.subCategory    = CC_BILL_PAYMENT_SUBCATEGORY;
        t.note           = data.note ?? `Bill paid from ${fromName}`;
        t.date           = dt;
        t.isJointExpense = false;
      });

      // 2. Debit side: negative amount = cash out
      await db.transactions.create((t: any) => {
        t.account.id     = data.fromDebitAccountId;
        t.amount         = -amt;
        t.category       = 'needs';
        t.subCategory    = ccBillTransferSubCategory(data.cardLabel);
        t.note           = data.note ?? `To ${data.cardLabel}`;
        t.date           = dt;
        t.isJointExpense = false;
      });

      // 3. Debit account balance updated atomically
      await debit.update((_a: any) => { _a.currentBalance -= amt; });
      // CC account: no balance mutation — outstanding is computed from transactions
    });

    // ── 4. Auto-advance paidEmis for any CC-linked EMI loans whose instalment
    //       falls in the current billing cycle and is covered by this payment.
    //       This keeps the EMI screen in sync — user does NOT need to manually
    //       "Mark Paid" on the EMI tab after paying the credit card bill.
    try {
      const ccRow = await db.accounts.find(data.creditCardAccountId) as any;
      const billDate: number | null = ccRow.billDate ?? null;
      if (billDate) {
        // Compute current cycle window (same logic as AccountStore.getCycleStart/getNextBillDate)
        const today = new Date();
        const cycleStart = today.getDate() >= billDate
          ? new Date(today.getFullYear(), today.getMonth(), billDate)
          : new Date(today.getFullYear(), today.getMonth() - 1, billDate);
        const cycleEnd = today.getDate() < billDate
          ? new Date(today.getFullYear(), today.getMonth(), billDate)
          : new Date(today.getFullYear(), today.getMonth() + 1, billDate);

        const cycleStartMs = cycleStart.getTime();
        const cycleEndMs   = cycleEnd.getTime();

        // Fetch all loans linked to this credit card
        const linkedLoans = this.root.loans.loans.filter(
          l => l.accountId === data.creditCardAccountId
        );

        for (const loan of linkedLoans) {
          const remaining = loan.tenureMonths - loan.paidEmis;
          if (remaining <= 0) continue; // fully paid

          const loanForBilling = {
            principal:    loan.principal,
            roi:          loan.roi,
            tenureMonths: loan.tenureMonths,
            paidEmis:     loan.paidEmis,
            startDate:    loan.startDate,
            emiDay:       loan.emiDay,
          };

          const nextDueMs = getNextEmiDueDate(loanForBilling).getTime();
          const isInThisCycle = nextDueMs >= cycleStartMs && nextDueMs < cycleEndMs;

          if (!isInThisCycle) continue; // this loan's EMI is not due this cycle

          const emiAmount = calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
          const newPaidEmis = loan.paidEmis + 1;

          // Advance paidEmis in DB
          await db.loans.database.write(async () => {
            const loanRow = await db.loans.find(loan.id) as any;
            await loanRow.update((l: any) => { l.paidEmis = newPaidEmis; });
          });

          // Log a bookkeeping EMI transaction on the CC account so the
          // EMI row is visible in transaction history (isEmiSubCategory = true,
          // so cardBilling ignores it from nonEmiCycleSpend).
          await db.transactions.database.write(async () => {
            await db.transactions.create((t: any) => {
              t.account.id     = data.creditCardAccountId;
              t.amount         = -Math.abs(emiAmount);
              t.category       = 'needs';
              t.subCategory    = emiSubCategory(loan.lender);
              t.note           = `EMI ${newPaidEmis} of ${loan.tenureMonths} (via CC bill)`;
              t.date           = dt;
              t.isJointExpense = false;
            });
          });
        }
      }
    } catch { /* non-critical: EMI auto-advance failed silently */ }

    // Reload both stores so MobX recomputes everything
    await Promise.all([this.load(), this.root.loans.load()]);
  }

  async deleteTransaction(id: string) {
    await db.transactions.database.write(async () => {
      const t = await db.transactions.find(id) as any;
      const { amount } = t;
      const accountId  = t.account?.id ?? t.accountId;

      // Revert debit account balance (credit cards are computed, no revert needed)
      try {
        const acc = await db.accounts.find(accountId) as any;
        if (acc && acc.type !== 'credit') {
          await acc.update((_acc: any) => { _acc.currentBalance -= amount; });
        }
      } catch { /* account not found */ }

      await t.destroyPermanently();
    });
    await this.load();
  }

  async updateTransaction(id: string, data: {
    accountId?: string; amount?: number; category?: string;
    subCategory?: string; note?: string; date?: Date;
  }) {
    await db.transactions.database.write(async () => {
      const t          = await db.transactions.find(id) as any;
      const oldAmount  = t.amount;
      const oldAccId   = t.account?.id ?? t.accountId;

      // Revert old amount from old debit account
      try {
        const oldAcc = await db.accounts.find(oldAccId) as any;
        if (oldAcc && oldAcc.type !== 'credit') {
          await oldAcc.update((_acc: any) => { _acc.currentBalance -= oldAmount; });
        }
      } catch { /* not found */ }

      // Apply update
      await t.update((_t: any) => {
        if (data.accountId   !== undefined) _t.account.id   = data.accountId;
        if (data.amount      !== undefined) _t.amount       = data.amount;
        if (data.category    !== undefined) _t.category     = data.category;
        if (data.subCategory !== undefined) _t.subCategory  = data.subCategory;
        if (data.note        !== undefined) _t.note         = data.note;
        if (data.date        !== undefined) _t.date         = data.date;
      });

      // Apply new amount to new debit account
      const newAccId  = data.accountId ?? oldAccId;
      const newAmount = data.amount    ?? oldAmount;
      try {
        const newAcc = await db.accounts.find(newAccId) as any;
        if (newAcc && newAcc.type !== 'credit') {
          await newAcc.update((_acc: any) => { _acc.currentBalance += newAmount; });
        }
      } catch { /* not found */ }
    });
    await this.load();
  }

  // ── Income sources CRUD ───────────────────────────────────────────────────

  async addIncomeSource(data: {
    name: string; amount: number; frequency: string; date: Date; accountId?: string;
  }) {
    await db.incomeSources.database.write(async () => {
      await db.incomeSources.create((i: any) => {
        i.name      = data.name;
        i.amount    = data.amount;
        i.frequency = data.frequency;
        i.date      = data.date;
      });

      // Optionally credit the income to a debit account
      if (data.accountId) {
        try {
          const acc = await db.accounts.find(data.accountId) as any;
          if (acc && acc.type !== 'credit') {
            // Create a transaction so the history is auditable
            await db.transactions.create((t: any) => {
              t.account.id     = data.accountId;
              t.amount         = data.amount;
              t.category       = 'income';
              t.subCategory    = data.name;
              t.note           = 'Income credit';
              t.date           = data.date;
              t.isJointExpense = false;
            });
            await acc.update((_acc: any) => { _acc.currentBalance += data.amount; });
          }
        } catch { /* account not found */ }
      }
    });
    await this.load();
  }

  async updateIncomeSource(id: string, data: { name?: string; amount?: number; frequency?: string }) {
    await db.incomeSources.database.write(async () => {
      const i = await db.incomeSources.find(id) as any;
      await i.update((_i: any) => {
        if (data.name      !== undefined) _i.name      = data.name;
        if (data.amount    !== undefined) _i.amount    = data.amount;
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
