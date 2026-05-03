import { calculateEMI } from './finance';

/** Matches EMI rows created via LoanStore.markEMIPaid. */
export function isLoanEmiSubCategory(sub: string | null | undefined): boolean {
  return !!sub && sub.startsWith('EMI –');
}

/** Bill payment received on the card (reduces statement balance). BudgetStore.payCreditCardBill. */
export const CREDIT_CARD_BILL_PAYMENT_SUBCATEGORY = 'Credit card bill payment';

export function isCreditCardBillPaymentSubCategory(sub: string | null | undefined): boolean {
  return !!sub && sub === CREDIT_CARD_BILL_PAYMENT_SUBCATEGORY;
}

export interface TxForBilling {
  amount: number;
  date: Date | number;
  subCategory?: string | null;
}

export interface LoanForBilling {
  principal: number;
  roi: number;
  tenureMonths: number;
  paidEmis: number;
  startDate: Date | number;
  emiDay: number;
}

/**
 * Calculates the next EMI date for a loan, respecting credit card statement cycles.
 * Logic:
 * 1. If purchase date <= billDay: First EMI is in the NEXT month's bill (Month + 1).
 * 2. If purchase date > billDay: First EMI is in the month AFTER the next bill (Month + 2).
 */
export function getNextEmiDate(loan: LoanForBilling & { startDate: Date | number, emiDay: number }): Date {
  const start = new Date(loan.startDate);
  const firstEmi = new Date(start.getFullYear(), start.getMonth(), loan.emiDay);
  
  if (start.getDate() > loan.emiDay) {
    // Purchase after bill date: skip next bill, start in the one after.
    firstEmi.setMonth(firstEmi.getMonth() + 2);
  } else {
    // Purchase on or before bill date: start in the next month's bill.
    firstEmi.setMonth(firstEmi.getMonth() + 1);
  }
  
  // Advance by number of paid EMIs
  if (loan.paidEmis > 0) {
    firstEmi.setMonth(firstEmi.getMonth() + loan.paidEmis);
  }
  return firstEmi;
}

/** Sum of one month’s EMI for every linked loan that has an instalment due in THIS cycle. */
export function monthlyEmiCommittedOnCard(
  loans: (LoanForBilling & { startDate: Date | number, emiDay: number })[],
  cycleStartMs: number,
  cycleEndMs: number
): number {
  let s = 0;
  for (const loan of loans) {
    const remaining = loan.tenureMonths - loan.paidEmis;
    if (remaining <= 0) continue;

    const nextDue = getNextEmiDate(loan);
    const nextDueMs = nextDue.getTime();

    // Only count if the next due date falls within this statement cycle.
    if (nextDueMs >= cycleStartMs && nextDueMs < cycleEndMs) {
      s += calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
    }
  }
  return s;
}

/** Total rupees left to pay on linked loans (= sum of remaining × monthly EMI). */
export function remainingEmiLiabilityTotalOnCard(loans: LoanForBilling[]): number {
  let s = 0;
  for (const loan of loans) {
    const rem = loan.tenureMonths - loan.paidEmis;
    if (rem <= 0) continue;
    const em = calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
    s += rem * em;
  }
  return s;
}

/**
 * Outstanding on credit card =
 * (1) Total **remaining EMI** payable on loans linked to the card — all installments left × EMI.
 * (2) Plus **non‑EMI net this cycle**: every movement on the ledger in the window except `EMI – …`
 * instalment rows (those are bookkeeping; liability is counted in (1)).
 */
export function computeCreditCardOutstandingThisCycle(
  cycleStartMs: number,
  cycleEndMs: number,
  txnsForAccount: TxForBilling[],
  linkedLoans: LoanForBilling[],
): {
  nonEmiCycleNet: number;
  remainingEmiLiabilityTotal: number;
  outstanding: number;
  emiLoggedInCycle: number;
  monthlyEmiCommitted: number;
  cycleStatementDue: number;
} {
  let nonEmiCycleNet = 0;
  let emiLoggedInCycle = 0;

  for (const t of txnsForAccount) {
    const dm = typeof t.date === 'number' ? t.date : new Date(t.date).getTime();
    if (dm < cycleStartMs) continue;
    if (t.amount < 0 && isLoanEmiSubCategory(t.subCategory)) {
      emiLoggedInCycle += Math.abs(t.amount);
      continue;
    }
    nonEmiCycleNet -= t.amount;
  }

  // nonEmiCycleNet = Purchases in this cycle minus bill payments in this cycle.
  // It can be negative if payments > spends (i.e. payments covered EMIs or pre-paid).

  const remainingEmiLiabilityTotal = remainingEmiLiabilityTotalOnCard(linkedLoans);
  const monthlyEmiCommitted = monthlyEmiCommittedOnCard(linkedLoans, cycleStartMs, cycleEndMs);

  // The actual amount due to the bank THIS month.
  // This increases if you spend more, and decreases if you pay.
  const cycleStatementDue = Math.max(0, nonEmiCycleNet + monthlyEmiCommitted);

  const outstanding = Math.round(nonEmiCycleNet + remainingEmiLiabilityTotal);

  return {
    nonEmiCycleNet,
    remainingEmiLiabilityTotal,
    outstanding,
    emiLoggedInCycle,
    monthlyEmiCommitted,
    cycleStatementDue,
  };
}

export function splitOutstandingNonEmiVsEmi(breakdown: {
  nonEmiCycleNet: number;
  remainingEmiLiabilityTotal: number;
}): {
  nonEmiOutstanding: number;
  emiOutstanding: number;
} {
  return {
    nonEmiOutstanding: Math.max(0, breakdown.nonEmiCycleNet),
    emiOutstanding: Math.max(0, breakdown.remainingEmiLiabilityTotal),
  };
}
