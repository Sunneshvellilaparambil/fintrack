import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import {
  Account, Transaction, IncomeSource, Loan,
  JointProject, JointMember, JointContribution,
  Stock, Goal, Chitty, Vehicle, ServiceLog,
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'fintrack',
  // SQLCipher encryption can be wired in via jsi.encryption when native keychain provides key
  jsi: true,
  migrations: undefined,
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Account, Transaction, IncomeSource, Loan,
    JointProject, JointMember, JointContribution,
    Stock, Goal, Chitty, Vehicle, ServiceLog,
  ],
});

// Convenience collection accessors
export const db = {
  accounts: database.collections.get<Account>('accounts'),
  transactions: database.collections.get<Transaction>('transactions'),
  incomeSources: database.collections.get<IncomeSource>('income_sources'),
  loans: database.collections.get<Loan>('loans'),
  jointProjects: database.collections.get<JointProject>('joint_projects'),
  jointMembers: database.collections.get<JointMember>('joint_members'),
  jointContributions: database.collections.get<JointContribution>('joint_contributions'),
  stocks: database.collections.get<Stock>('stocks'),
  goals: database.collections.get<Goal>('goals'),
  chittys: database.collections.get<Chitty>('chittys'),
  vehicles: database.collections.get<Vehicle>('vehicles'),
  serviceLogs: database.collections.get<ServiceLog>('service_logs'),
};
