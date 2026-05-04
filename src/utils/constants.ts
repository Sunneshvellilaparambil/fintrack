// ─── Sub-category constants ───────────────────────────────────────────────
// Use these constants everywhere — never hardcode these strings inline.
// isEmiSubCategory depends on the EM DASH (U+2013) prefix — never use a plain hyphen.

export const CC_BILL_PAYMENT_SUBCATEGORY = 'Credit card bill payment';
export const EMI_SUBCATEGORY_PREFIX = 'EMI \u2013 '; // EM DASH + space

/** Build the sub_category string for an EMI transaction. */
export const emiSubCategory = (lender: string) =>
  `${EMI_SUBCATEGORY_PREFIX}${lender}`;

/** Build the sub_category for the debit-side of a CC bill payment. */
export const ccBillTransferSubCategory = (cardLabel: string) =>
  `CC bill \u00b7 ${cardLabel}`;

/** Returns true if this sub_category represents an EMI instalment row. */
export function isEmiSubCategory(sub?: string | null): boolean {
  return !!sub && sub.startsWith(EMI_SUBCATEGORY_PREFIX);
}

/** Returns true if this sub_category is a credit-card bill payment. */
export function isBillPaymentSubCategory(sub?: string | null): boolean {
  return sub === CC_BILL_PAYMENT_SUBCATEGORY;
}
