import { calculateEMI } from './finance';
import {
  CC_BILL_PAYMENT_SUBCATEGORY,
  EMI_SUBCATEGORY_PREFIX,
  isEmiSubCategory,
  isBillPaymentSubCategory,
} from './constants';

// Re-export constants so existing imports from cardBilling still work
export {
  CC_BILL_PAYMENT_SUBCATEGORY,
  EMI_SUBCATEGORY_PREFIX,
  isEmiSubCategory,
  isBillPaymentSubCategory,
};
export const CREDIT_CARD_BILL_PAYMENT_SUBCATEGORY = CC_BILL_PAYMENT_SUBCATEGORY; // compat alias

// ─── Types ───────────────────────────────────────────────────────────────────

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
  startDate: Date | number; // required — used to compute first EMI date
  emiDay: number;           // required — day of month EMI falls on
}

export interface CreditCardBreakdown {
  nonEmiCycleSpend: number;       // purchases this cycle (excl. EMI rows)
  billPaymentsInCycle: number;    // payments received this cycle
  emiLoggedInCycle: number;       // EMI transaction rows (bookkeeping only)
  monthlyEmiDue: number;          // one instalment × loans due this cycle
  remainingEmiTotal: number;      // all remaining instalments × EMI
  cycleStatementDue: number;      // what's on this month's statement
  totalOutstanding: number;       // total debt incl. all future EMIs
  isPaid: boolean;                // cycleStatementDue <= ₹1

  // ── Backward-compat aliases ──────────────────────────────────────────────
  nonEmiCycleNet: number;              // = nonEmiCycleSpend − billPaymentsInCycle
  remainingEmiLiabilityTotal: number;  // = remainingEmiTotal
  monthlyEmiCommitted: number;         // = monthlyEmiDue
  outstanding: number;                 // = totalOutstanding
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMs(d: Date | number): number {
  return typeof d === 'number' ? d : d.getTime();
}

/**
 * Returns the Date of the next unpaid EMI for a loan, accounting for
 * whether the purchase date was before or after the bill date.
 *
 * Rule:
 *  - purchase on/before emiDay → first EMI in the NEXT calendar month (month+1)
 *  - purchase after emiDay     → first EMI skips one more month (month+2)
 *  Then advance by paidEmis to reach the NEXT upcoming due date.
 */
export function getNextEmiDueDate(loan: LoanForBilling): Date {
  const start = new Date(loan.startDate);
  const monthOffset = start.getDate() > loan.emiDay ? 2 : 1;
  const dueMonth = start.getMonth() + monthOffset + loan.paidEmis;
  return new Date(start.getFullYear(), dueMonth, loan.emiDay);
}

/**
 * Sum of one month's EMI for each loan whose next instalment falls
 * inside [cycleStartMs, cycleEndMs).
 */
export function monthlyEmiCommittedOnCard(
  loans: LoanForBilling[],
  cycleStartMs: number,
  cycleEndMs: number,
): number {
  return loans.reduce((sum, loan) => {
    const remaining = loan.tenureMonths - loan.paidEmis;
    if (remaining <= 0) return sum;
    const nextDueMs = getNextEmiDueDate(loan).getTime();
    if (nextDueMs >= cycleStartMs && nextDueMs < cycleEndMs) {
      return sum + calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
    }
    return sum;
  }, 0);
}

/** Total rupees remaining across all linked loans (all future instalments). */
export function remainingEmiLiabilityTotalOnCard(loans: LoanForBilling[]): number {
  return loans.reduce((sum, loan) => {
    const remaining = loan.tenureMonths - loan.paidEmis;
    if (remaining <= 0) return sum;
    return sum + remaining * calculateEMI(loan.principal, loan.roi, loan.tenureMonths);
  }, 0);
}

/**
 * Computes the full credit card billing breakdown for one statement cycle.
 *
 * ALL 4 arguments are required.
 * loans[] MUST include startDate + emiDay — the function returns 0 for
 * monthlyEmiDue if those fields are missing.
 *
 * Transaction categorisation:
 *   sub_category starts with 'EMI – '        → EMI row (skip from spend, count via loans)
 *   sub_category === 'Credit card bill payment' → payment received (reduces due)
 *   everything else                           → regular purchase / refund
 *
 * Cycle window: cycleStartMs ≤ txn.date < cycleEndMs  (both bounds enforced)
 */
export function computeCreditCardOutstandingThisCycle(
  cycleStartMs: number,
  cycleEndMs: number,   // ← required upper bound; transactions on/after this belong to next cycle
  txnsForAccount: TxForBilling[],
  linkedLoans: LoanForBilling[],
): CreditCardBreakdown {
  let nonEmiCycleSpend = 0;
  let billPaymentsInCycle = 0;
  let emiLoggedInCycle = 0;

  for (const t of txnsForAccount) {
    const dm = toMs(t.date);
    if (dm < cycleStartMs) continue;  // before this cycle
    if (dm >= cycleEndMs) continue;   // after this cycle → belongs to next bill

    if (isEmiSubCategory(t.subCategory)) {
      // EMI instalment rows are bookkeeping entries.
      // The actual liability is accounted for via loan.paidEmis below.
      if (t.amount < 0) emiLoggedInCycle += Math.abs(t.amount);
      continue;
    }

    if (isBillPaymentSubCategory(t.subCategory)) {
      // Payment credited to the card
      if (t.amount > 0) billPaymentsInCycle += t.amount;
      continue;
    }

    // Regular purchase (negative) or refund (positive)
    if (t.amount < 0) {
      nonEmiCycleSpend += Math.abs(t.amount);
    } else {
      nonEmiCycleSpend = Math.max(0, nonEmiCycleSpend - t.amount);
    }
  }

  const monthlyEmiDue = monthlyEmiCommittedOnCard(linkedLoans, cycleStartMs, cycleEndMs);
  const remainingEmiTotal = remainingEmiLiabilityTotalOnCard(linkedLoans);

  const cycleStatementDue = Math.max(
    0,
    nonEmiCycleSpend + monthlyEmiDue - billPaymentsInCycle,
  );
  const totalOutstanding = Math.max(
    0,
    nonEmiCycleSpend + remainingEmiTotal - billPaymentsInCycle,
  );

  return {
    nonEmiCycleSpend,
    billPaymentsInCycle,
    emiLoggedInCycle,
    monthlyEmiDue,
    remainingEmiTotal,
    cycleStatementDue,
    totalOutstanding,
    isPaid: cycleStatementDue <= 1,
    // backward-compat aliases
    nonEmiCycleNet: nonEmiCycleSpend - billPaymentsInCycle,
    remainingEmiLiabilityTotal: remainingEmiTotal,
    monthlyEmiCommitted: monthlyEmiDue,
    outstanding: totalOutstanding,
  };
}

/** @deprecated Use the fields on CreditCardBreakdown directly. */
export function splitOutstandingNonEmiVsEmi(breakdown: {
  nonEmiCycleNet?: number;
  nonEmiCycleSpend?: number;
  billPaymentsInCycle?: number;
  remainingEmiLiabilityTotal?: number;
  remainingEmiTotal?: number;
}): { nonEmiOutstanding: number; emiOutstanding: number } {
  const nonEmi = breakdown.nonEmiCycleSpend ??
    Math.max(0, breakdown.nonEmiCycleNet ?? 0);
  const emi = breakdown.remainingEmiTotal ?? breakdown.remainingEmiLiabilityTotal ?? 0;
  return {
    nonEmiOutstanding: Math.max(0, nonEmi),
    emiOutstanding: Math.max(0, emi),
  };
}
