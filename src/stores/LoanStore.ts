import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Loan } from '../db/models';
import { calculateEMI, generateAmortization, AmortizationRow, calculateTaxBenefits, TaxBenefit } from '../utils/finance';

export class LoanStore {
  loans: Loan[] = [];
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    runInAction(() => { this.loading = true; });
    const result = await db.loans.query().fetch();
    runInAction(() => {
      this.loans = result;
      this.loading = false;
    });
  }

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

  get totalMonthlyEMI(): number {
    return this.loans.reduce((s, l) => s + calculateEMI(l.principal, l.roi, l.tenureMonths), 0);
  }

  get housingLoans() { return this.loans.filter(l => l.type === 'housing'); }
  get vehicleLoans() { return this.loans.filter(l => l.type === 'vehicle'); }
  get personalLoans() { return this.loans.filter(l => l.type === 'personal'); }

  async addLoan(data: {
    type: string; lender: string; principal: number;
    roi: number; tenureMonths: number; startDate: Date;
    emiDay: number; accountId?: string; paidEmis?: number;
  }) {
    await db.loans.database.write(async () => {
      await db.loans.create(l => {
        (l as any).type = data.type;
        (l as any).lender = data.lender;
        (l as any).principal = data.principal;
        (l as any).roi = data.roi;
        (l as any).tenureMonths = data.tenureMonths;
        (l as any).startDate = data.startDate;
        (l as any).emiDay = data.emiDay;
        (l as any).paidEmis = data.paidEmis ?? 0;
        (l as any).accountId = data.accountId ?? null;
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
        if (data.type !== undefined) l.type = data.type;
        if (data.lender !== undefined) l.lender = data.lender;
        if (data.principal !== undefined) l.principal = data.principal;
        if (data.roi !== undefined) l.roi = data.roi;
        if (data.tenureMonths !== undefined) l.tenureMonths = data.tenureMonths;
        if (data.startDate !== undefined) l.startDate = data.startDate;
        if (data.emiDay !== undefined) l.emiDay = data.emiDay;
        if (data.paidEmis !== undefined) l.paidEmis = data.paidEmis;
        if (data.accountId !== undefined) l.accountId = data.accountId || null;
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
   * If the loan is linked to a credit card account (accountId set), also writes
   * a transaction against that card so the EMI appears in the card's billing cycle.
   * Pass `creditCardAccountIds` – the set of account IDs that are credit cards –
   * so we can decide whether to log a transaction.
   */
  async markEMIPaid(loanId: string, creditCardAccountIds?: Set<string>) {
    await db.loans.database.write(async () => {
      const loan = await db.loans.find(loanId) as any;
      const emiAmount = calculateEMI(loan.principal, loan.roi, loan.tenureMonths);

      // Increment paidEmis
      await loan.update((l: any) => {
        l.paidEmis = l.paidEmis + 1;
      });

      // If linked to ANY account (debit/credit) -> log transaction & update balance
      if (loan.accountId) {
        try {
          const acc = await db.accounts.find(loan.accountId) as any;
          
          await db.transactions.create((t: any) => {
            t.accountId = loan.accountId;
            t.amount = -Math.abs(emiAmount); // negative = expense
            t.category = 'needs';
            t.subCategory = `EMI – ${loan.lender}`;
            t.note = `EMI #${loan.paidEmis} of ${loan.tenureMonths}`;
            t.date = new Date();
            t.isJointExpense = false;
          });

          await acc.update((_acc: any) => {
            // For credit cards, balance = unpaid purchases + remaining EMIs. 
            // Marking EMI as paid shifts it from remaining EMIs to unpaid purchases, so total balance is unchanged!
            // For debit cards, spending decreases cash balance.
            if (_acc.type !== 'credit') {
              _acc.currentBalance -= Math.abs(emiAmount);
            }
          });
        } catch (e) {
          // Linked account not found
        }
      }
    });
    await this.load();
  }
}
