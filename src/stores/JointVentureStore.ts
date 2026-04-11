import { makeAutoObservable, runInAction } from 'mobx';
import { db } from '../db';
import { JointProject, JointMember, JointContribution } from '../db/models';
import { computeSettlement, SettlementResult } from '../utils/finance';
import { Q } from '@nozbe/watermelondb';

export class JointVentureStore {
  projects: JointProject[] = [];
  members: Map<string, JointMember[]> = new Map();
  contributions: Map<string, JointContribution[]> = new Map();
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    runInAction(() => { this.loading = true; });
    const projects = await db.jointProjects.query().fetch();
    const membersMap = new Map<string, JointMember[]>();
    const contribMap = new Map<string, JointContribution[]>();

    await Promise.all(projects.map(async (p) => {
      const [members, contribs] = await Promise.all([
        db.jointMembers.query(Q.where('project_id', p.id)).fetch(),
        db.jointContributions.query(Q.where('project_id', p.id)).fetch(),
      ]);
      membersMap.set(p.id, members);
      contribMap.set(p.id, contribs);
    }));

    runInAction(() => {
      this.projects = projects;
      this.members = membersMap;
      this.contributions = contribMap;
      this.loading = false;
    });
  }

  settlement(projectId: string): SettlementResult | null {
    const members = this.members.get(projectId) ?? [];
    const contribs = this.contributions.get(projectId) ?? [];
    const selfMember = members.find(m => m.isSelf);
    const otherMember = members.find(m => !m.isSelf);
    if (!selfMember) return null;

    const totalSpend = contribs.reduce((s, c) => s + c.amount, 0);
    const selfPaid = contribs
      .filter(c => c.memberId === selfMember.id)
      .reduce((s, c) => s + c.amount, 0);

    return computeSettlement(
      totalSpend,
      selfPaid,
      selfMember.ownershipPct,
      otherMember?.name ?? 'Co-owner',
    );
  }

  async createProject(data: {
    name: string; description?: string;
    members: { name: string; isSelf: boolean; ownershipPct: number }[];
  }) {
    await db.jointProjects.database.write(async () => {
      const project = await db.jointProjects.create(p => {
        (p as any).name = data.name;
        (p as any).description = data.description ?? null;
        (p as any).status = 'active';
      });
      await Promise.all(
        data.members.map(m =>
          db.jointMembers.create(mem => {
            (mem as any).projectId = project.id;
            (mem as any).name = m.name;
            (mem as any).isSelf = m.isSelf;
            (mem as any).ownershipPct = m.ownershipPct;
          }),
        ),
      );
    });
    await this.load();
  }

  async addContribution(data: {
    projectId: string; memberId: string;
    amount: number; description: string; date: Date; isJointEmi?: boolean;
  }) {
    await db.jointContributions.database.write(async () => {
      await db.jointContributions.create(c => {
        (c as any).projectId = data.projectId;
        (c as any).memberId = data.memberId;
        (c as any).amount = data.amount;
        (c as any).description = data.description;
        (c as any).date = data.date;
        (c as any).isJointEmi = data.isJointEmi ?? false;
      });
    });
    await this.load();
  }
}
