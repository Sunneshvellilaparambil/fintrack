/**
 * FinTrack — Financial Calculation Utilities
 * All calculations are performed 100% locally.
 */

// ─── EMI & Amortization ───────────────────────────────────────────────────────

export interface AmortizationRow {
  month: number;
  emi: number;
  principal: number;
  interest: number;
  balance: number;
}

/**
 * Calculate monthly EMI using reducing balance formula.
 * EMI = P × [r(1+r)^n] / [(1+r)^n – 1]
 */
export function calculateEMI(principal: number, annualROI: number, tenureMonths: number): number {
  if (annualROI === 0) return principal / tenureMonths;
  const r = annualROI / 12 / 100;
  const n = tenureMonths;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Generate full amortization schedule.
 */
export function generateAmortization(
  principal: number,
  annualROI: number,
  tenureMonths: number,
): AmortizationRow[] {
  const emi = calculateEMI(principal, annualROI, tenureMonths);
  const r = annualROI / 12 / 100;
  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let month = 1; month <= tenureMonths; month++) {
    const interest = balance * r;
    const principalPaid = emi - interest;
    balance = Math.max(0, balance - principalPaid);
    rows.push({
      month,
      emi: round2(emi),
      principal: round2(principalPaid),
      interest: round2(interest),
      balance: round2(balance),
    });
  }
  return rows;
}

/**
 * Calculate total interest paid over loan tenure.
 */
export function totalInterest(principal: number, annualROI: number, tenureMonths: number): number {
  const emi = calculateEMI(principal, annualROI, tenureMonths);
  return round2(emi * tenureMonths - principal);
}

// ─── Tax Benefit (India) ──────────────────────────────────────────────────────

const SEC_24B_LIMIT = 200000;  // ₹2,00,000
const SEC_80C_LIMIT = 150000;  // ₹1,50,000

export interface TaxBenefit {
  annualInterest: number;
  sec24bDeduction: number;
  annualPrincipal: number;
  sec80cDeduction: number;
  totalDeduction: number;
}

export function calculateTaxBenefits(
  principal: number,
  annualROI: number,
  tenureMonths: number,
  paidEmis: number,
): TaxBenefit {
  const schedule = generateAmortization(principal, annualROI, tenureMonths);
  // Current financial year rows (last 12 from paid position, capped)
  const start = Math.max(0, paidEmis - 12);
  const end = Math.min(paidEmis, schedule.length);
  const yearRows = schedule.slice(start, end);

  const annualInterest = yearRows.reduce((s, r) => s + r.interest, 0);
  const annualPrincipal = yearRows.reduce((s, r) => s + r.principal, 0);

  return {
    annualInterest: round2(annualInterest),
    sec24bDeduction: round2(Math.min(annualInterest, SEC_24B_LIMIT)),
    annualPrincipal: round2(annualPrincipal),
    sec80cDeduction: round2(Math.min(annualPrincipal, SEC_80C_LIMIT)),
    totalDeduction: round2(
      Math.min(annualInterest, SEC_24B_LIMIT) + Math.min(annualPrincipal, SEC_80C_LIMIT),
    ),
  };
}

// ─── 50/30/20 Budget Engine ───────────────────────────────────────────────────

export interface BudgetAllocation {
  monthlyIncome: number;
  needs: { allocated: number; spent: number; remaining: number };
  wants: { allocated: number; spent: number; remaining: number };
  savings: { allocated: number; spent: number; remaining: number };
  safeToSpend: number;
}

export function computeBudget(
  monthlyIncome: number,
  needsSpent: number,
  wantsSpent: number,
  savingsSpent: number,
): BudgetAllocation {
  const needsAlloc = monthlyIncome * 0.5;
  const wantsAlloc = monthlyIncome * 0.3;
  const savingsAlloc = monthlyIncome * 0.2;

  // Safe-to-spend = remaining in Wants, minus any overflow from Needs
  const needsOverflow = Math.max(0, needsSpent - needsAlloc);
  const safeToSpend = Math.max(0, wantsAlloc - wantsSpent - needsOverflow);

  return {
    monthlyIncome,
    needs: { allocated: needsAlloc, spent: needsSpent, remaining: needsAlloc - needsSpent },
    wants: { allocated: wantsAlloc, spent: wantsSpent, remaining: wantsAlloc - wantsSpent },
    savings: { allocated: savingsAlloc, spent: savingsSpent, remaining: savingsAlloc - savingsSpent },
    safeToSpend,
  };
}

// ─── Joint Venture Settlement ─────────────────────────────────────────────────

export interface SettlementResult {
  totalSpend: number;
  selfPaid: number;
  selfFairShare: number;
  delta: number;          // positive = others owe self; negative = self owes others
  settlementText: string;
}

export function computeSettlement(
  totalSpend: number,
  selfPaid: number,
  selfOwnershipPct: number,
  otherMemberName: string = 'Co-owner',
): SettlementResult {
  const selfFairShare = totalSpend * (selfOwnershipPct / 100);
  const delta = selfPaid - selfFairShare;

  let settlementText: string;
  if (Math.abs(delta) < 1) {
    settlementText = 'All settled! 🎉';
  } else if (delta > 0) {
    settlementText = `${otherMemberName} owes YOU ₹${formatINR(delta)}`;
  } else {
    settlementText = `YOU owe ${otherMemberName} ₹${formatINR(Math.abs(delta))}`;
  }

  return { totalSpend, selfPaid, selfFairShare, delta, settlementText };
}

// ─── Retirement / Corpus ──────────────────────────────────────────────────────

/**
 * Inflation-adjusted future value of a lump sum.
 * FV = PV × (1 + r)^n
 */
export function inflationAdjustedValue(
  currentValue: number,
  inflationRate: number, // annual %
  years: number,
): number {
  return round2(currentValue * Math.pow(1 + inflationRate / 100, years));
}

/**
 * Future value of monthly SIP contributions.
 */
export function sipFutureValue(
  monthlyContribution: number,
  annualReturnRate: number,
  years: number,
): number {
  const r = annualReturnRate / 12 / 100;
  const n = years * 12;
  return round2(monthlyContribution * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

// ─── Debt-to-Income Ratio ─────────────────────────────────────────────────────

export function debtToIncomeRatio(monthlyEMITotal: number, monthlyIncome: number): number {
  if (monthlyIncome === 0) return 0;
  return round2((monthlyEMITotal / monthlyIncome) * 100);
}

export function affordabilityScore(dtiRatio: number): { label: string; color: string } {
  if (dtiRatio <= 35) return { label: 'Healthy', color: '#00D9A3' };
  if (dtiRatio <= 50) return { label: 'Caution', color: '#FFB84D' };
  return { label: 'Overstretched', color: '#FF5C5C' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatINR(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  }
  if (compact && Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function creditUtilizationColor(utilPct: number): string {
  if (utilPct < 30) return '#00D9A3';
  if (utilPct < 50) return '#FFB84D';
  return '#FF5C5C';
}
