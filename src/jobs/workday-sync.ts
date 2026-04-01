/**
 * Workday Sync Job
 *
 * Pluggable adapter pattern — swap out the mock adapter for a real
 * Workday Prism/SOAP implementation without changing job logic.
 */

import { prisma } from "@/lib/prisma";

// ─── Adapter Interface ────────────────────────────────────────────────────────

export type WorkdayUser = {
  workdayId: string;
  email: string;
  name: string;
  title?: string;
  department?: string;
  managerWorkdayId?: string;
  costCenterCode?: string;
  isActive: boolean;
};

export interface WorkdayAdapter {
  fetchUsers(): Promise<WorkdayUser[]>;
}

// ─── Mock Adapter ─────────────────────────────────────────────────────────────

export class MockWorkdayAdapter implements WorkdayAdapter {
  async fetchUsers(): Promise<WorkdayUser[]> {
    // Return existing users from DB as if they came from Workday
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, title: true, department: true, workdayId: true },
    });
    return users.map((u) => ({
      workdayId: u.workdayId ?? `WD-${u.id}`,
      email: u.email,
      name: u.name,
      title: u.title ?? undefined,
      department: u.department ?? undefined,
      isActive: true,
    }));
  }
}

// ─── Real Adapter Stub ────────────────────────────────────────────────────────

export class WorkdaySOAPAdapter implements WorkdayAdapter {
  constructor(
    private readonly tenantUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {}

  async fetchUsers(): Promise<WorkdayUser[]> {
    // TODO: Implement actual Workday SOAP/REST API call
    // This is where you'd call the Workday Human_Resources API
    throw new Error("WorkdaySOAPAdapter not yet implemented — use WORKDAY_ADAPTER=mock");
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createWorkdayAdapter(): WorkdayAdapter {
  const adapterType = process.env.WORKDAY_ADAPTER ?? "mock";
  if (adapterType === "mock") return new MockWorkdayAdapter();
  return new WorkdaySOAPAdapter(
    process.env.WORKDAY_TENANT_URL!,
    process.env.WORKDAY_USERNAME!,
    process.env.WORKDAY_PASSWORD!
  );
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────

export type SyncResult = {
  created: number;
  updated: number;
  deactivated: number;
  errors: Array<{ workdayId: string; message: string }>;
};

export async function runWorkdayUserSync(): Promise<SyncResult> {
  const adapter = createWorkdayAdapter();
  const result: SyncResult = { created: 0, updated: 0, deactivated: 0, errors: [] };

  const workdayUsers = await adapter.fetchUsers();
  const workdayIds = new Set(workdayUsers.map((u) => u.workdayId));

  for (const wdUser of workdayUsers) {
    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ workdayId: wdUser.workdayId }, { email: wdUser.email }] },
      });

      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            workdayId: wdUser.workdayId,
            name: wdUser.name,
            title: wdUser.title,
            department: wdUser.department,
            isActive: wdUser.isActive,
          },
        });
        result.updated++;
      } else {
        await prisma.user.create({
          data: {
            workdayId: wdUser.workdayId,
            email: wdUser.email,
            name: wdUser.name,
            title: wdUser.title,
            department: wdUser.department,
            isActive: wdUser.isActive,
            passwordHash: "", // will need password reset
          },
        });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ workdayId: wdUser.workdayId, message: String(err) });
    }
  }

  // Deactivate users no longer in Workday
  const deactivated = await prisma.user.updateMany({
    where: {
      workdayId: { notIn: Array.from(workdayIds), not: null },
      isActive: true,
    },
    data: { isActive: false },
  });
  result.deactivated = deactivated.count;

  return result;
}
