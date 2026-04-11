import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, readonly, text, children, relation } from '@nozbe/watermelondb/decorators';

// ─── Account ─────────────────────────────────────────────────────────────────
export class Account extends Model {
  static table = 'accounts';

  // Define children so you can do account.transactions.fetch()
  @children('transactions') transactions!: any;

  @text('name') name!: string;
  @text('type') type!: string;
  @text('bank_name') bankName!: string;
  @field('card_last2') cardLast2!: string | null;
  @field('card_type') cardType!: string | null;
  @field('credit_limit') creditLimit!: number | null;
  @field('current_balance') currentBalance!: number;
  @date('bill_date') billDate!: Date | null; 
  @date('due_date') dueDate!: Date | null; 
  @readonly @date('created_at') createdAt!: Date;
}

// ─── Transaction ─────────────────────────────────────────────────────────────
export class Transaction extends Model {
  static table = 'transactions';

  @text('account_id') accountId!: string;
  @relation('accounts', 'account_id') account!: Relation<Account>; // Added Relation

  @field('amount') amount!: number;
  @text('category') category!: string;
  @text('sub_category') subCategory!: string;
  @field('note') note!: string | null;
  @date('date') date!: Date;
  @field('is_joint_expense') isJointExpense!: boolean;
}

// ─── Income Source ────────────────────────────────────────────────────────────
export class IncomeSource extends Model {
  static table = 'income_sources';
  @text('name') name!: string;
  @field('amount') amount!: number;
  @text('frequency') frequency!: string;
  @date('date') date!: Date;
}

// ─── Loan ─────────────────────────────────────────────────────────────────────
export class Loan extends Model {
  static table = 'loans';
  @text('type') type!: string;
  @text('lender') lender!: string;
  @field('principal') principal!: number;
  @field('roi') roi!: number;
  @field('tenure_months') tenureMonths!: number;
  @date('start_date') startDate!: Date;
  @field('emi_day') emiDay!: number;
  @field('paid_emis') paidEmis!: number;

  @text('account_id') accountId!: string | null;
  @relation('accounts', 'account_id') account!: Relation<Account>;
}

// ─── Joint Project ────────────────────────────────────────────────────────────
export class JointProject extends Model {
  static table = 'joint_projects';
  @children('joint_members') members!: any;
  @children('joint_contributions') contributions!: any;

  @text('name') name!: string;
  @field('description') description!: string | null;
  @text('status') status!: string;
  @readonly @date('created_at') createdAt!: Date;
}

export class JointMember extends Model {
  static table = 'joint_members';
  @text('project_id') projectId!: string;
  @relation('joint_projects', 'project_id') project!: Relation<JointProject>;

  @text('name') name!: string;
  @field('is_self') isSelf!: boolean;
  @field('ownership_pct') ownershipPct!: number;
}

export class JointContribution extends Model {
  static table = 'joint_contributions';
  @text('project_id') projectId!: string;
  @relation('joint_projects', 'project_id') project!: Relation<JointProject>;

  @text('member_id') memberId!: string;
  @relation('joint_members', 'member_id') member!: Relation<JointMember>;

  @field('amount') amount!: number;
  @text('description') description!: string;
  @date('date') date!: Date;
  @field('is_joint_emi') isJointEmi!: boolean;
}

// ─── Stock ────────────────────────────────────────────────────────────────────
export class Stock extends Model {
  static table = 'stocks';
  @text('symbol') symbol!: string;
  @text('name') name!: string;
  @field('quantity') quantity!: number;
  @field('avg_buy_price') avgBuyPrice!: number;
  @field('current_price') currentPrice!: number;
  @date('last_updated') lastUpdated!: Date;
}

// ─── Goal ─────────────────────────────────────────────────────────────────────
export class Goal extends Model {
  static table = 'goals';
  @text('name') name!: string;
  @field('target_amount') targetAmount!: number;
  @field('current_amount') currentAmount!: number;
  @date('target_date') targetDate!: Date;
  @text('color') color!: string;
}

// ─── Chitty ───────────────────────────────────────────────────────────────────
export class Chitty extends Model {
  static table = 'chittys';
  @text('name') name!: string;
  @field('monthly_installment') monthlyInstallment!: number;
  @field('total_value') totalValue!: number;
  @field('duration_months') durationMonths!: number;
  @date('start_date') startDate!: Date;
  @field('auction_dividends') auctionDividends!: number;
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────
export class Vehicle extends Model {
  static table = 'vehicles';
  @children('service_logs') serviceLogs!: any;

  @text('name') name!: string;
  @text('reg_number') regNumber!: string;
  @field('odometer') odometer!: number;
  @date('insurance_due') insuranceDue!: Date;

  @text('loan_id') loanId!: string | null;
  @relation('loans', 'loan_id') loan!: Relation<Loan>;
}

export class ServiceLog extends Model {
  static table = 'service_logs';
  @text('vehicle_id') vehicleId!: string;
  @relation('vehicles', 'vehicle_id') vehicle!: Relation<Vehicle>;

  @date('date') date!: Date;
  @field('odometer') odometer!: number;
  @text('description') description!: string;
  @field('cost') cost!: number;
}
