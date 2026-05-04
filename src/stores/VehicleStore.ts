import { makeAutoObservable, runInAction } from 'mobx';
import { Q } from '@nozbe/watermelondb';
import { db } from '../db';
import { Vehicle, ServiceLog, OdometerHistory } from '../db/models';
import type { RootStore } from './index';

export class VehicleStore {
  vehicles: Vehicle[] = [];
  serviceLogsByVehicle     = new Map<string, ServiceLog[]>();
  odometerHistoryByVehicle = new Map<string, OdometerHistory[]>();
  loading = false;

  private root: RootStore;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  async load() {
    runInAction(() => { this.loading = true; });
    const [vh, logs, history] = await Promise.all([
      db.vehicles.query().fetch(),
      db.serviceLogs.query().fetch(),
      db.odometerHistory.query().fetch(),
    ]);
    runInAction(() => {
      this.vehicles = vh;

      const logMap = new Map<string, ServiceLog[]>();
      logs.forEach(l => {
        const pool = logMap.get(l.vehicleId) ?? [];
        pool.push(l);
        logMap.set(l.vehicleId, pool);
      });
      this.serviceLogsByVehicle = logMap;

      const hMap = new Map<string, OdometerHistory[]>();
      history.forEach(h => {
        const pool = hMap.get(h.vehicleId) ?? [];
        pool.push(h);
        hMap.set(h.vehicleId, pool);
      });
      this.odometerHistoryByVehicle = hMap;
      this.loading = false;
    });
  }

  // ── Vehicles CRUD ─────────────────────────────────────────────────────────

  async addVehicle(data: {
    name: string; regNumber: string; odometer: number;
    insuranceDue: Date; loanId?: string;
    nextServiceDate?: Date; nextServiceKm?: number;
  }) {
    await db.vehicles.database.write(async () => {
      await db.vehicles.create((v: any) => {
        v.name            = data.name;
        v.regNumber       = data.regNumber;
        v.odometer        = data.odometer;
        v.insuranceDue    = data.insuranceDue;
        v.loanId          = data.loanId          ?? null;
        v.nextServiceDate = data.nextServiceDate  ?? null;
        v.nextServiceKm   = data.nextServiceKm    ?? null;
      });
    });
    await this.load();
  }

  async updateVehicle(id: string, data: {
    name?: string; regNumber?: string; odometer?: number;
    insuranceDue?: Date; loanId?: string;
    nextServiceDate?: Date | null; nextServiceKm?: number | null;
  }) {
    await db.vehicles.database.write(async () => {
      const v = await db.vehicles.find(id) as any;
      await v.update((_v: any) => {
        if (data.name            !== undefined) _v.name            = data.name;
        if (data.regNumber       !== undefined) _v.regNumber       = data.regNumber;
        if (data.odometer        !== undefined) _v.odometer        = data.odometer;
        if (data.insuranceDue    !== undefined) _v.insuranceDue    = data.insuranceDue;
        if (data.loanId          !== undefined) _v.loanId          = data.loanId || null;
        if (data.nextServiceDate !== undefined) _v.nextServiceDate = data.nextServiceDate;
        if (data.nextServiceKm   !== undefined) _v.nextServiceKm   = data.nextServiceKm;
      });
    });
    await this.load();
  }

  async deleteVehicle(id: string) {
    await db.vehicles.database.write(async () => {
      // Use Q.where to fetch only this vehicle's logs (not ALL logs)
      const [logs, odoms] = await Promise.all([
        db.serviceLogs.query(Q.where('vehicle_id', id)).fetch(),
        db.odometerHistory.query(Q.where('vehicle_id', id)).fetch(),
      ]);
      for (const l of logs)  await l.destroyPermanently();
      for (const h of odoms) await h.destroyPermanently();
      await (await db.vehicles.find(id)).destroyPermanently();
    });
    await this.load();
  }

  // ── Odometer ──────────────────────────────────────────────────────────────

  /** Record a standalone odometer reading (not associated with a service log). */
  async updateOdometer(vehicleId: string, odometer: number, date: Date = new Date()) {
    await db.vehicles.database.write(async () => {
      await db.odometerHistory.create((h: any) => {
        h.vehicleId = vehicleId;
        h.odometer  = odometer;
        h.date      = date;
      });
      const v = await db.vehicles.find(vehicleId) as any;
      if (v && odometer > v.odometer) {
        await v.update((_v: any) => { _v.odometer = odometer; });
      }
    });
    await this.load();
  }

  // ── Service logs CRUD ─────────────────────────────────────────────────────

  async addServiceLog(data: {
    vehicle_id: string; date: Date; odometer: number;
    serviceName: string; description: string; cost: number;
    isRecurring: boolean; recurringBy?: 'km' | 'date';
    nextServiceKm?: number; nextServiceDate?: Date;
  }) {
    await db.serviceLogs.database.write(async () => {
      let finalNextKm   = data.nextServiceKm;
      let finalNextDate = data.nextServiceDate;

      // Auto-calculate interval from previous log of the same service
      if (data.isRecurring) {
        const getMs = (d: any) => d ? (d instanceof Date ? d.getTime() : new Date(d).getTime()) : 0;
        const logs = await db.serviceLogs
          .query(Q.where('vehicle_id', data.vehicle_id))
          .fetch() as any[];

        const lastLog = logs
          .filter(l => l.serviceName === data.serviceName)
          .sort((a, b) => {
            const dt = getMs(b.date) - getMs(a.date);
            return dt !== 0 ? dt : b.odometer - a.odometer;
          })[0];

        if (lastLog) {
          if (data.recurringBy === 'km' && !finalNextKm && lastLog.nextServiceKm) {
            finalNextKm = data.odometer + (lastLog.nextServiceKm - lastLog.odometer);
          } else if (data.recurringBy === 'date' && !finalNextDate && lastLog.nextServiceDate) {
            const interval = getMs(lastLog.nextServiceDate) - getMs(lastLog.date);
            finalNextDate  = new Date(getMs(data.date) + interval);
          }
        }
      }

      // Create service log
      await db.serviceLogs.create((l: any) => {
        l.vehicleId      = data.vehicle_id;
        l.date           = data.date;
        l.odometer       = data.odometer;
        l.serviceName    = data.serviceName;
        l.description    = data.description || null;
        l.cost           = data.cost;
        l.isRecurring    = data.isRecurring;
        l.recurringBy    = data.recurringBy    ?? null;
        l.nextServiceKm  = finalNextKm         ?? null;
        l.nextServiceDate= finalNextDate        ?? null;
      });

      // Create one odometer history entry (addServiceLog only — no separate call needed)
      await db.odometerHistory.create((h: any) => {
        h.vehicleId = data.vehicle_id;
        h.odometer  = data.odometer;
        h.date      = data.date;
      });

      // Update vehicle's current odometer if this is a new high
      const v = await db.vehicles.find(data.vehicle_id) as any;
      if (v && data.odometer > v.odometer) {
        await v.update((_v: any) => { _v.odometer = data.odometer; });
      }
    });
    await this.load();
  }

  async updateServiceLog(id: string, data: {
    date?: Date; odometer?: number; serviceName?: string; description?: string;
    cost?: number; isRecurring?: boolean; recurringBy?: 'km' | 'date';
    nextServiceKm?: number | null; nextServiceDate?: Date | null;
  }) {
    await db.serviceLogs.database.write(async () => {
      const l = await db.serviceLogs.find(id) as any;
      await l.update((_l: any) => {
        if (data.date            !== undefined) _l.date            = data.date;
        if (data.odometer        !== undefined) _l.odometer        = data.odometer;
        if (data.serviceName     !== undefined) _l.serviceName     = data.serviceName;
        if (data.description     !== undefined) _l.description     = data.description || null;
        if (data.cost            !== undefined) _l.cost            = data.cost;
        if (data.isRecurring     !== undefined) _l.isRecurring     = data.isRecurring;
        if (data.recurringBy     !== undefined) _l.recurringBy     = data.recurringBy || null;
        if (data.nextServiceKm   !== undefined) _l.nextServiceKm   = data.nextServiceKm;
        if (data.nextServiceDate !== undefined) _l.nextServiceDate = data.nextServiceDate;
      });

      if (data.odometer !== undefined) {
        const v = await db.vehicles.find(l.vehicleId) as any;
        if (v && data.odometer > v.odometer) {
          await v.update((_v: any) => { _v.odometer = data.odometer; });
        }
      }
    });
    await this.load();
  }

  async deleteServiceLog(id: string) {
    await db.serviceLogs.database.write(async () => {
      (await db.serviceLogs.find(id) as any).destroyPermanently();
    });
    await this.load();
  }

  getTotalServiceCost(vehicleId: string): number {
    return (this.serviceLogsByVehicle.get(vehicleId) ?? [])
      .reduce((sum, log) => sum + log.cost, 0);
  }
}
