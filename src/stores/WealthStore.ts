import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Stock, Goal, Chitty, RD } from '../db/models';
import { round2, calculateRDmaturity } from '../utils/finance';
import type { RootStore } from './index';

export class WealthStore {
  stocks: Stock[]  = [];
  goals: Goal[]    = [];
  chittys: Chitty[] = [];
  rds: RD[] = [];
  loading = false;

  private root: RootStore;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  async load() {
    runInAction(() => { this.loading = true; });
    const [stocks, goals, chittys, rds] = await Promise.all([
      db.stocks.query().fetch(),
      db.goals.query().fetch(),
      db.chittys.query().fetch(),
      db.rds.query().fetch(),
    ]);
    runInAction(() => {
      this.stocks  = stocks;
      this.goals   = goals;
      this.chittys = chittys;
      this.rds = rds;
      this.loading = false;
    });
  }

  // ── Portfolio ─────────────────────────────────────────────────────────────
  get portfolioValue():   number { return round2(this.stocks.reduce((s, st) => s + st.quantity * st.currentPrice, 0)); }
  get portfolioCost():    number { return round2(this.stocks.reduce((s, st) => s + st.quantity * st.avgBuyPrice, 0)); }
  get portfolioPnL():     number { return round2(this.portfolioValue - this.portfolioCost); }
  get portfolioPnLPct():  number {
    return this.portfolioCost === 0 ? 0 : round2((this.portfolioPnL / this.portfolioCost) * 100);
  }

  stockPnL(stock: Stock): { value: number; pct: number } {
    const cost  = stock.quantity * stock.avgBuyPrice;
    const value = stock.quantity * stock.currentPrice;
    const pnl   = value - cost;
    return { value: round2(pnl), pct: round2(cost === 0 ? 0 : (pnl / cost) * 100) };
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  goalProgress(goal: Goal): number {
    return goal.targetAmount === 0 ? 0 : round2((goal.currentAmount / goal.targetAmount) * 100);
  }
  get totalGoalsFunded(): number { return round2(this.goals.reduce((s, g) => s + g.currentAmount, 0)); }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async addStock(data: { symbol: string; name: string; quantity: number; avgBuyPrice: number; currentPrice: number }) {
    await db.stocks.database.write(async () => {
      await db.stocks.create(s => {
        (s as any).symbol       = data.symbol;
        (s as any).name         = data.name;
        (s as any).quantity     = data.quantity;
        (s as any).avgBuyPrice  = data.avgBuyPrice;
        (s as any).currentPrice = data.currentPrice;
        (s as any).lastUpdated  = new Date();
      });
    });
    await this.load();
  }

  async updateStockPrice(stockId: string, currentPrice: number) {
    await db.stocks.database.write(async () => {
      const stock = await db.stocks.find(stockId);
      await stock.update(s => {
        (s as any).currentPrice = currentPrice;
        (s as any).lastUpdated  = new Date();
      });
    });
    await this.load();
  }

  async deleteStock(id: string) {
    await db.stocks.database.write(async () => { (await db.stocks.find(id)).destroyPermanently(); });
    await this.load();
  }

  async addGoal(data: { name: string; targetAmount: number; targetDate: Date; color: string }) {
    await db.goals.database.write(async () => {
      await db.goals.create(g => {
        (g as any).name          = data.name;
        (g as any).targetAmount  = data.targetAmount;
        (g as any).currentAmount = 0;
        (g as any).targetDate    = data.targetDate;
        (g as any).color         = data.color;
      });
    });
    await this.load();
  }

  async updateGoal(id: string, data: { name?: string; targetAmount?: number; currentAmount?: number; targetDate?: Date; color?: string }) {
    await db.goals.database.write(async () => {
      const g = await db.goals.find(id) as any;
      await g.update((_g: any) => {
        if (data.name          !== undefined) _g.name          = data.name;
        if (data.targetAmount  !== undefined) _g.targetAmount  = data.targetAmount;
        if (data.currentAmount !== undefined) _g.currentAmount = data.currentAmount;
        if (data.targetDate    !== undefined) _g.targetDate    = data.targetDate;
        if (data.color         !== undefined) _g.color         = data.color;
      });
    });
    await this.load();
  }

  async fundGoal(goalId: string, amount: number) {
    await db.goals.database.write(async () => {
      const goal = await db.goals.find(goalId);
      await goal.update(g => {
        (g as any).currentAmount = Math.min(g.currentAmount + amount, g.targetAmount);
      });
    });
    await this.load();
  }

  async deleteGoal(id: string) {
    await db.goals.database.write(async () => { (await db.goals.find(id)).destroyPermanently(); });
    await this.load();
  }

  async addChitty(data: { name: string; monthlyInstallment: number; totalValue: number; durationMonths: number; startDate: Date }) {
    await db.chittys.database.write(async () => {
      await db.chittys.create(c => {
        (c as any).name                = data.name;
        (c as any).monthlyInstallment  = data.monthlyInstallment;
        (c as any).totalValue          = data.totalValue;
        (c as any).durationMonths      = data.durationMonths;
        (c as any).startDate           = data.startDate;
        (c as any).auctionDividends    = 0;
      });
    });
    await this.load();
  }

  async updateChitty(id: string, data: { name?: string; monthlyInstallment?: number; totalValue?: number; durationMonths?: number; startDate?: Date; auctionDividends?: number }) {
    await db.chittys.database.write(async () => {
      const c = await db.chittys.find(id) as any;
      await c.update((_c: any) => {
        if (data.name               !== undefined) _c.name               = data.name;
        if (data.monthlyInstallment !== undefined) _c.monthlyInstallment = data.monthlyInstallment;
        if (data.totalValue         !== undefined) _c.totalValue         = data.totalValue;
        if (data.durationMonths     !== undefined) _c.durationMonths     = data.durationMonths;
        if (data.startDate          !== undefined) _c.startDate          = data.startDate;
        if (data.auctionDividends   !== undefined) _c.auctionDividends   = data.auctionDividends;
      });
    });
    await this.load();
  }

  async addAuctionDividend(chittyId: string, dividend: number) {
    await db.chittys.database.write(async () => {
      const chitty = await db.chittys.find(chittyId);
      await chitty.update(c => { (c as any).auctionDividends = c.auctionDividends + dividend; });
    });
    await this.load();
  }

  async deleteChitty(id: string) {
    await db.chittys.database.write(async () => { (await db.chittys.find(id)).destroyPermanently(); });
    await this.load();
  }

  // ── RDs ──────────────────────────────────────────────────────────────────────
  async addRD(data: { name: string; monthlyInstallment: number; durationMonths: number; roi: number; startDate: Date; depositDay: number; accountId?: string }) {
    await db.rds.database.write(async () => {
      await db.rds.create((r: any) => {
        r.name = data.name;
        r.monthlyInstallment = data.monthlyInstallment;
        r.durationMonths = data.durationMonths;
        r.roi = data.roi;
        r.startDate = data.startDate;
        r.depositDay = data.depositDay;
        r.paidInstallments = 0;
        r.accountId = data.accountId || null;
      });
    });
    await this.load();
  }

  async updateRD(id: string, data: Partial<{ name: string; monthlyInstallment: number; durationMonths: number; roi: number; startDate: Date; depositDay: number; paidInstallments: number; accountId: string }>) {
    await db.rds.database.write(async () => {
      const r = await db.rds.find(id) as any;
      await r.update((_r: any) => {
        if (data.name !== undefined) _r.name = data.name;
        if (data.monthlyInstallment !== undefined) _r.monthlyInstallment = data.monthlyInstallment;
        if (data.durationMonths !== undefined) _r.durationMonths = data.durationMonths;
        if (data.roi !== undefined) _r.roi = data.roi;
        if (data.startDate !== undefined) _r.startDate = data.startDate;
        if (data.depositDay !== undefined) _r.depositDay = data.depositDay;
        if (data.paidInstallments !== undefined) _r.paidInstallments = data.paidInstallments;
        if (data.accountId !== undefined) _r.accountId = data.accountId;
      });
    });
    await this.load();
  }

  async deleteRD(id: string) {
    await db.rds.database.write(async () => { (await db.rds.find(id)).destroyPermanently(); });
    await this.load();
  }

  async payRDInstallment(rdId: string, accountId: string, amount: number) {
    await db.rds.database.write(async () => {
      const r = await db.rds.find(rdId) as any;
      if (r.paidInstallments >= r.durationMonths) return; // already completed
      await r.update((_r: any) => {
        _r.paidInstallments += 1;
      });
    });
    
    // Also deduct the amount from budget store / transactions
    await this.root.budget.addTransaction({
      accountId,
      amount: -amount,
      category: 'savings',
      subCategory: 'RD Installment',
      date: new Date(),
      note: 'Auto-recorded RD installment',
    });
    
    await this.load();
  }
}
