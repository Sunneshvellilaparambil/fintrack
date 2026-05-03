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
}

/** Sum of one month’s EMI for every linked loan that still has instalments left. */
export function monthlyEmiCommittedOnCard(loans: LoanForBilling[]): number {
  let s = 0;
  for (const loan of loans) {
    const remaining = loan.tenureMonths - loan.paidEmis;
    if (remaining > 0) {
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
  txnsForAccount: TxForBilling[],
  linkedLoans: LoanForBilling[],
): {
  nonEmiCycleNet: number;
  remainingEmiLiabilityTotal: number;
  outstanding: number;
  emiLoggedInCycle: number;
  monthlyEmiCommitted: number;
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

  nonEmiCycleNet = Math.max(0, nonEmiCycleNet);

  const remainingEmiLiabilityTotal = remainingEmiLiabilityTotalOnCard(linkedLoans);
  const monthlyEmiCommitted = monthlyEmiCommittedOnCard(linkedLoans);

  const outstanding = Math.round(nonEmiCycleNet + remainingEmiLiabilityTotal);

  return {
    nonEmiCycleNet,
    remainingEmiLiabilityTotal,
    outstanding,
    emiLoggedInCycle,
    monthlyEmiCommitted,
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
