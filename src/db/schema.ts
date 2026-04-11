import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // ── Accounts & Cards ──────────────────────────────────────────────────
    tableSchema({
      name: 'accounts',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' },           // 'debit' | 'credit'
        { name: 'bank_name', type: 'string' },
        { name: 'card_last2', type: 'string', isOptional: true },
        { name: 'card_type', type: 'string', isOptional: true },  // visa | mastercard | rupay
        { name: 'credit_limit', type: 'number', isOptional: true },
        { name: 'current_balance', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Transactions ─────────────────────────────────────────────────────
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'account_id', type: 'string', isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'category', type: 'string' },       // needs | wants | savings
        { name: 'sub_category', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'date', type: 'number' },            // unix ms
        { name: 'is_joint_expense', type: 'boolean' },
      ],
    }),

    // ── Income Sources ────────────────────────────────────────────────────
    tableSchema({
      name: 'income_sources',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'frequency', type: 'string' },      // monthly | one-time
        { name: 'date', type: 'number' },
      ],
    }),

    // ── Loans (EMI Hub) ──────────────────────────────────────────────────
    tableSchema({
      name: 'loans',
      columns: [
        { name: 'type', type: 'string' },           // housing | vehicle | personal
        { name: 'lender', type: 'string' },
        { name: 'principal', type: 'number' },
        { name: 'roi', type: 'number' },            // annual %
        { name: 'tenure_months', type: 'number' },
        { name: 'start_date', type: 'number' },
        { name: 'emi_day', type: 'number' },        // day of month
        { name: 'paid_emis', type: 'number' },
        { name: 'account_id', type: 'string', isOptional: true },
      ],
    }),

    // ── Joint Projects ────────────────────────────────────────────────────
    tableSchema({
      name: 'joint_projects',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },         // active | completed
        { name: 'created_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'joint_members',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'is_self', type: 'boolean' },
        { name: 'ownership_pct', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'joint_contributions',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'member_id', type: 'string', isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'description', type: 'string' },
        { name: 'date', type: 'number' },
        { name: 'is_joint_emi', type: 'boolean' },
      ],
    }),

    // ── Stocks ───────────────────────────────────────────────────────────
    tableSchema({
      name: 'stocks',
      columns: [
        { name: 'symbol', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'avg_buy_price', type: 'number' },
        { name: 'current_price', type: 'number' },
        { name: 'last_updated', type: 'number' },
      ],
    }),

    // ── Goals ─────────────────────────────────────────────────────────────
    tableSchema({
      name: 'goals',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'target_amount', type: 'number' },
        { name: 'current_amount', type: 'number' },
        { name: 'target_date', type: 'number' },
        { name: 'color', type: 'string' },
      ],
    }),

    // ── Chittys ──────────────────────────────────────────────────────────
    tableSchema({
      name: 'chittys',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'monthly_installment', type: 'number' },
        { name: 'total_value', type: 'number' },
        { name: 'duration_months', type: 'number' },
        { name: 'start_date', type: 'number' },
        { name: 'auction_dividends', type: 'number' },
      ],
    }),

    // ── Vehicles ──────────────────────────────────────────────────────────
    tableSchema({
      name: 'vehicles',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'reg_number', type: 'string' },
        { name: 'odometer', type: 'number' },
        { name: 'insurance_due', type: 'number' },
        { name: 'loan_id', type: 'string', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'service_logs',
      columns: [
        { name: 'vehicle_id', type: 'string', isIndexed: true },
        { name: 'date', type: 'number' },
        { name: 'odometer', type: 'number' },
        { name: 'description', type: 'string' },
        { name: 'cost', type: 'number' },
      ],
    }),
  ],
});
