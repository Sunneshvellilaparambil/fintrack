import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { Vehicle, ServiceLog } from '../db/models';

export class VehicleStore {
  vehicles: Vehicle[] = [];
  serviceLogsByVehicle = new Map<string, ServiceLog[]>();
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    runInAction(() => { this.loading = true; });
    const [vh, logs] = await Promise.all([
      db.vehicles.query().fetch(),
      db.serviceLogs.query().fetch(),
    ]);
    runInAction(() => {
      this.vehicles = vh;
      // map logs
      const map = new Map<string, ServiceLog[]>();
      logs.forEach(l => {
        const pool = map.get(l.vehicleId) || [];
        pool.push(l);
        map.set(l.vehicleId, pool);
      });
      this.serviceLogsByVehicle = map;
      this.loading = false;
    });
  }

  async addVehicle(data: { name: string; regNumber: string; odometer: number; insuranceDue: Date; loanId?: string }) {
    await db.vehicles.database.write(async () => {
      await db.vehicles.create((v: any) => {
        v.name = data.name;
        v.regNumber = data.regNumber;
        v.odometer = data.odometer;
        v.insuranceDue = data.insuranceDue;
        v.loanId = data.loanId;
      });
    });
    await this.load();
  }

  async updateVehicle(id: string, data: { name?: string; regNumber?: string; odometer?: number; insuranceDue?: Date; loanId?: string }) {
    await db.vehicles.database.write(async () => {
      const v = await db.vehicles.find(id) as any;
      await v.update((_v: any) => {
        if (data.name !== undefined) _v.name = data.name;
        if (data.regNumber !== undefined) _v.regNumber = data.regNumber;
        if (data.odometer !== undefined) _v.odometer = data.odometer;
        if (data.insuranceDue !== undefined) _v.insuranceDue = data.insuranceDue;
        if (data.loanId !== undefined) _v.loanId = data.loanId;
      });
    });
    await this.load();
  }

  async deleteVehicle(id: string) {
    await db.vehicles.database.write(async () => {
      const v = await db.vehicles.find(id) as any;
      // Delete logs too
      const logs = await db.serviceLogs.query().fetch();
      for (const l of logs) {
        if (l.vehicleId === id) await l.destroyPermanently();
      }
      await v.destroyPermanently();
    });
    await this.load();
  }

  async addServiceLog(data: { vehicle_id: string; date: Date; odometer: number; description: string; cost: number }) {
    await db.serviceLogs.database.write(async () => {
      await db.serviceLogs.create((l: any) => {
        l.vehicleId = data.vehicle_id;
        l.date = data.date;
        l.odometer = data.odometer;
        l.description = data.description;
        l.cost = data.cost;
      });
      // update vehicle odometer
      const v = await db.vehicles.find(data.vehicle_id) as any;
      if (v && data.odometer > v.odometer) {
        await v.update((_v: any) => { _v.odometer = data.odometer; });
      }
    });
    await this.load();
  }

  async deleteServiceLog(id: string) {
    await db.serviceLogs.database.write(async () => {
      const l = await db.serviceLogs.find(id) as any;
      await l.destroyPermanently();
    });
    await this.load();
  }

  getTotalServiceCost(vehicleId: string) {
    return (this.serviceLogsByVehicle.get(vehicleId) ?? [])
      .reduce((sum, log) => sum + log.cost, 0);
  }
}
