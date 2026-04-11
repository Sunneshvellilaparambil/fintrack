import { AccountStore } from './AccountStore';
import { BudgetStore } from './BudgetStore';
import { LoanStore } from './LoanStore';
import { JointVentureStore } from './JointVentureStore';
import { WealthStore } from './WealthStore';
import { AuthStore } from './AuthStore';
import { VehicleStore } from './VehicleStore';
import React from 'react';

export const stores = {
  auth: new AuthStore(),
  accounts: new AccountStore(),
  budget: new BudgetStore(),
  loans: new LoanStore(),
  jointVenture: new JointVentureStore(),
  wealth: new WealthStore(),
  vehicles: new VehicleStore(),
};

export type Stores = typeof stores;

const StoreContext = React.createContext<Stores>(stores);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  React.createElement(StoreContext.Provider, { value: stores }, children)
);

export const useStores = () => React.useContext(StoreContext);

// Load all stores after auth succeeds
export async function loadAllStores() {
  await Promise.all([
    stores.accounts.load(),
    stores.budget.load(),
    stores.loans.load(),
    stores.jointVenture.load(),
    stores.wealth.load(),
    stores.vehicles.load(),
  ]);
}
