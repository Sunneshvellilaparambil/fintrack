import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Loan } from '../db/models';
import {
  calculateEMI, generateAmortization,
  AmortizationRow, calculateTaxBenefits, TaxBenefit,
} from '../utils/finance';
import { emiSubCategory } from '../utils/constants';
import type { RootStore } from './index';

export class LoanStore {
  loans: Loan[] = [];
  loading = false;

  private root: RootStore;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  async load() {
    runInAction(() => { this.loading = true; });
    const result = await db.loans.query().fetch();
    runInAction(() => {
      this.loans   = result;
      this.loading = false;
    });
  }

  // ── Pure helpers ──────────────────────────────────────────────────────────

  emi(loan: Loan): number {
    return calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
  }

  amortization(loan: Loan): AmortizationRow[] {
    return generateAmortization(loan.principal, loan.roi, loan.tenureMonths);
  }

  taxBenefits(loan: Loan): TaxBenefit | null {
    if (loan.type !== 'housing') return null;
    return calculateTaxBenefits(loan.principal, loan.roi, loan.tenureMonths, loan.paidEmis);
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Total monthly EMI outflow — active (incomplete) loans only. */
  get totalMonthlyEMI(): number {
    return this.loans
      .filter(l => l.paidEmis < l.tenureMonths) // ← exclude fully paid loans
      .reduce((s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);
  }

  get housingLoans()  { return this.loans.filter(l => l.type === 'housing'); }
  get vehicleLoans()  { return this.loans.filter(l => l.type === 'vehicle'); }
  get personalLoans() { return this.loans.filter(l => l.type === 'personal'); }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async addLoan(data: {
    type: string; lender: string; principal: number;
    roi: number; tenureMonths: number; startDate: Date;
    emiDay: number; accountId?: string; paidEmis?: number;
  }) {
    await db.loans.database.write(async () => {
      await db.loans.create(l => {
        (l as any).type         = data.type;
        (l as any).lender       = data.lender;
        (l as any).principal    = data.principal;
        (l as any).roi          = data.roi;
        (l as any).tenureMonths = data.tenureMonths;
        (l as any).startDate    = data.startDate;
        (l as any).emiDay       = data.emiDay;
        (l as any).paidEmis     = data.paidEmis ?? 0;
        (l as any).accountId    = data.accountId ?? null;
      });
    });
    await this.load();
  }

  async updateLoan(id: string, data: {
    type?: string; lender?: string; principal?: number;
    roi?: number; tenureMonths?: number; startDate?: Date;
    emiDay?: number; accountId?: string; paidEmis?: number;
  }) {
    await db.loans.database.write(async () => {
      const loan = await db.loans.find(id) as any;
      await loan.update((l: any) => {
        if (data.type         !== undefined) l.type         = data.type;
        if (data.lender       !== undefined) l.lender       = data.lender;
        if (data.principal    !== undefined) l.principal    = data.principal;
        if (data.roi          !== undefined) l.roi          = data.roi;
        if (data.tenureMonths !== undefined) l.tenureMonths = data.tenureMonths;
        if (data.startDate    !== undefined) l.startDate    = data.startDate;
        if (data.emiDay       !== undefined) l.emiDay       = data.emiDay;
        if (data.paidEmis     !== undefined) l.paidEmis     = data.paidEmis;
        if (data.accountId    !== undefined) l.accountId    = data.accountId || null;
      });
    });
    await this.load();
  }

  async deleteLoan(id: string) {
    await db.loans.database.write(async () => {
      const loan = await db.loans.find(id);
      await loan.destroyPermanently();
    });
    await this.load();
  }

  /**
   * Mark the current month's EMI as paid.
   *
   * In ONE atomic db.write():
   *   1. loans.paid_emis  += 1
   *   2. transactions.create on the linked account (if any)
   *   3. debit account balance -= EMI  (credit cards are never mutated here)
   */
  async markEMIPaid(loanId: string) {
    const loan = this.loans.find(l => l.id === loanId);
    if (!loan) return;
    if (loan.paidEmis >= loan.tenureMonths) return; // all paid

    const emiAmount  = calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
    const newPaidNum = loan.paidEmis + 1;

    await db.loans.database.write(async () => {
      // 1. Increment paidEmis
      const loanRow = await db.loans.find(loanId) as any;
      await loanRow.update((l: any) => { l.paidEmis = l.paidEmis + 1; });

      // 2. Create transaction on linked account (if set)
      if (loan.accountId) {
        try {
          const acc = await db.accounts.find(loan.accountId) as any;

          await db.transactions.create((t: any) => {
            t.account.id     = loan.accountId;           // ← relation setter (correct)
            t.amount         = -Math.abs(emiAmount);     // negative = money out
            t.category       = 'needs';
            t.subCategory    = emiSubCategory(loan.lender); // 'EMI – SBI Home Loan'
            t.note           = `EMI ${newPaidNum} of ${loan.tenureMonths}`;
            t.date           = new Date();
            t.isJointExpense = false;
          });

          // 3. Update balance for debit accounts only
          if (acc.type !== 'credit') {
            await acc.update((_acc: any) => {
              _acc.currentBalance -= Math.abs(emiAmount);
            });
          }
          // Credit cards: no balance mutation — outstanding is computed from transactions
        } catch { /* linked account not found */ }
      }
    });

    await this.load();
  }
}
