import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import migrations from './migrations';
import {
  Account, Transaction, IncomeSource, Loan,
  JointProject, JointMember, JointContribution,
  Stock, Goal, Chitty, Vehicle, ServiceLog, OdometerHistory,
} from './models';

export let database: Database;
export let db: any;

export function initDB(profileId: string) {
  const adapter = new SQLiteAdapter({
    schema,
    dbName: `fintrack_${profileId}`,
    // SQLCipher encryption can be wired in via jsi.encryption when native keychain provides key
    jsi: true,
    migrations,
    onSetUpError: (error) => {
      console.error('[WatermelonDB] Setup error:', error);
    },
  });

  database = new Database({
    adapter,
    modelClasses: [
      Account, Transaction, IncomeSource, Loan,
      JointProject, JointMember, JointContribution,
      Stock, Goal, Chitty, Vehicle, ServiceLog, OdometerHistory,
    ],
  });

  // Convenience collection accessors
  db = {
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
    odometerHistory: database.collections.get<OdometerHistory>('odometer_history'),
  };
}

// Initialize with default database
initDB('default');
