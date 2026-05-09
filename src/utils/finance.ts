/**
 * FinTrack — Financial Calculation Utilities
 * All calculations are performed 100% locally.
 */

// ─── EMI & Amortization ───────────────────────────────────────────────────────

/**
 * Reverse-solve: given EMI, principal, and tenure, derive annual ROI (%).
 * Uses Newton-Raphson iteration. Returns 0 if interest-free.
 */
export function calculateROIFromEMI(
  emi: number,
  principal: number,
  tenureMonths: number,
): number {
  const e = Number(emi);
  const p = Number(principal);
  const n = Number(tenureMonths);

  // Edge case: zero interest
  if (Math.abs(e * n - p) < 1) return 0;

  let r = 0.01; // initial guess: 1% monthly
  for (let i = 0; i < 1000; i++) {
    const pow = Math.pow(1 + r, n);
    const f  = p * r * pow - e * (pow - 1);
    const df = p * (pow + r * n * Math.pow(1 + r, n - 1))
             - e * n * Math.pow(1 + r, n - 1);
    const rNext = r - f / df;
    if (Math.abs(rNext - r) < 1e-9) { r = rNext; break; }
    r = rNext;
  }
  // convert monthly rate to annual %
  return round2(r * 12 * 100);
}

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
  const p = Number(principal);
  const roi = Number(annualROI);
  const n = Number(tenureMonths);

  if (n <= 0) return 0;
  if (roi === 0) return p / n;
  const r = roi / 12 / 100;
  return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
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
  if (years <= 0) return 0;
  const r = annualReturnRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return round2(monthlyContribution * n);
  return round2(monthlyContribution * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

export const calculateRDmaturity = (installment: number, annualRoi: number, months: number) => {
  return sipFutureValue(installment, annualRoi, months / 12);
};

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
  const num = Number(n);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Indian rupees with full grouping (lakhs / thousands separators). Always full digits — no “1.5K / 2L” shortening.
 * Second arg kept for callers that passed `compact` historically; ignored.
 */
export function formatINR(amount: number, _compactIgnored?: boolean): string {
  const num = Number(amount);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

export function creditUtilizationColor(utilPct: number): string {
  if (utilPct < 30) return '#00D9A3';
  if (utilPct < 50) return '#FFB84D';
  return '#FF5C5C';
}
