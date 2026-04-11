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
    emiDay: number; accountId?: string;
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
        (l as any).paidEmis = 0;
        (l as any).accountId = data.accountId ?? null;
      });
    });
    await this.load();
  }

  async markEMIPaid(loanId: string) {
    await db.loans.database.write(async () => {
      const loan = await db.loans.find(loanId);
      await loan.update(l => {
        (l as any).paidEmis = l.paidEmis + 1;
      });
    });
    await this.load();
  }
}
