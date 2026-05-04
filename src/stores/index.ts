import React from 'react';
import { AuthStore } from './AuthStore';
import { AccountStore } from './AccountStore';
import { BudgetStore } from './BudgetStore';
import { LoanStore } from './LoanStore';
import { JointVentureStore } from './JointVentureStore';
import { WealthStore } from './WealthStore';
import { VehicleStore } from './VehicleStore';

// ─── RootStore ───────────────────────────────────────────────────────────────
// Owns all child stores and wires their cross-store dependencies.
// Screens destructure from this: const { accounts, budget, loans } = useStores()
// ─────────────────────────────────────────────────────────────────────────────

export class RootStore {
  auth: AuthStore;
  accounts: AccountStore;
  budget: BudgetStore;
  loans: LoanStore;
  jointVenture: JointVentureStore;
  wealth: WealthStore;
  vehicles: VehicleStore;

  constructor() {
    this.auth         = new AuthStore(this);
    this.accounts     = new AccountStore(this);
    this.budget       = new BudgetStore(this);
    this.loans        = new LoanStore(this);
    this.jointVenture = new JointVentureStore(this);
    this.wealth       = new WealthStore(this);
    this.vehicles     = new VehicleStore(this);
  }

  /** Load all stores after the DB is initialised for the active profile. */
  async loadAll() {
    await Promise.all([
      this.accounts.load(),
      this.budget.load(),
      this.loans.load(),
      this.jointVenture.load(),
      this.wealth.load(),
      this.vehicles.load(),
    ]);
    // No manual recalculate calls needed — AccountStore.creditCardSummaries
    // is a MobX @computed that auto-updates when budget/loans change.
  }
}

export type Stores = RootStore;

// ─── Singleton + Context ─────────────────────────────────────────────────────

export const stores = new RootStore();

const StoreContext = React.createContext<RootStore>(stores);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(StoreContext.Provider, { value: stores }, children);

export const useStores = () => React.useContext(StoreContext);

/** @deprecated Use stores.loadAll() directly. Kept for backward compat. */
export async function loadAllStores() {
  await stores.loadAll();
}
