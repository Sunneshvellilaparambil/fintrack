import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Stock, Goal, Chitty } from '../db/models';
import { round2 } from '../utils/finance';

export class WealthStore {
  stocks: Stock[] = [];
  goals: Goal[] = [];
  chittys: Chitty[] = [];
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    runInAction(() => { this.loading = true; });
    const [stocks, goals, chittys] = await Promise.all([
      db.stocks.query().fetch(),
      db.goals.query().fetch(),
      db.chittys.query().fetch(),
    ]);
    runInAction(() => {
      this.stocks = stocks;
      this.goals = goals;
      this.chittys = chittys;
      this.loading = false;
    });
  }

  // ── Portfolio ────────────────────────────────────────────────────────────
  get portfolioValue(): number {
    return round2(this.stocks.reduce((s, st) => s + st.quantity * st.currentPrice, 0));
  }

  get portfolioCost(): number {
    return round2(this.stocks.reduce((s, st) => s + st.quantity * st.avgBuyPrice, 0));
  }

  get portfolioPnL(): number {
    return round2(this.portfolioValue - this.portfolioCost);
  }

  get portfolioPnLPct(): number {
    if (this.portfolioCost === 0) return 0;
    return round2((this.portfolioPnL / this.portfolioCost) * 100);
  }

  stockPnL(stock: Stock): { value: number; pct: number } {
    const cost = stock.quantity * stock.avgBuyPrice;
    const value = stock.quantity * stock.currentPrice;
    const pnl = value - cost;
    const pct = cost === 0 ? 0 : (pnl / cost) * 100;
    return { value: round2(pnl), pct: round2(pct) };
  }

  // ── Goals ───────────────────────────────────────────────────────────────
  goalProgress(goal: Goal): number {
    if (goal.targetAmount === 0) return 0;
    return round2((goal.currentAmount / goal.targetAmount) * 100);
  }

  get totalGoalsFunded(): number {
    return round2(this.goals.reduce((s, g) => s + g.currentAmount, 0));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async addStock(data: {
    symbol: string; name: string; quantity: number;
    avgBuyPrice: number; currentPrice: number;
  }) {
    await db.stocks.database.write(async () => {
      await db.stocks.create(s => {
        (s as any).symbol = data.symbol;
        (s as any).name = data.name;
        (s as any).quantity = data.quantity;
        (s as any).avgBuyPrice = data.avgBuyPrice;
        (s as any).currentPrice = data.currentPrice;
        (s as any).lastUpdated = new Date();
      });
    });
    await this.load();
  }

  async updateStockPrice(stockId: string, currentPrice: number) {
    await db.stocks.database.write(async () => {
      const stock = await db.stocks.find(stockId);
      await stock.update(s => {
        (s as any).currentPrice = currentPrice;
        (s as any).lastUpdated = new Date();
      });
    });
    await this.load();
  }

  async addGoal(data: { name: string; targetAmount: number; targetDate: Date; color: string }) {
    await db.goals.database.write(async () => {
      await db.goals.create(g => {
        (g as any).name = data.name;
        (g as any).targetAmount = data.targetAmount;
        (g as any).currentAmount = 0;
        (g as any).targetDate = data.targetDate;
        (g as any).color = data.color;
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

  async addChitty(data: {
    name: string; monthlyInstallment: number;
    totalValue: number; durationMonths: number; startDate: Date;
  }) {
    await db.chittys.database.write(async () => {
      await db.chittys.create(c => {
        (c as any).name = data.name;
        (c as any).monthlyInstallment = data.monthlyInstallment;
        (c as any).totalValue = data.totalValue;
        (c as any).durationMonths = data.durationMonths;
        (c as any).startDate = data.startDate;
        (c as any).auctionDividends = 0;
      });
    });
    await this.load();
  }

  async addAuctionDividend(chittyId: string, dividend: number) {
    await db.chittys.database.write(async () => {
      const chitty = await db.chittys.find(chittyId);
      await chitty.update(c => {
        (c as any).auctionDividends = c.auctionDividends + dividend;
      });
    });
    await this.load();
  }
}
