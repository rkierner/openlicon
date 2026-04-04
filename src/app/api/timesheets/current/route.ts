import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const ENTRY_INCLUDE = {
  task: {
    select: {
      id: true,
      name: true,
      code: true,
      capitalizable: true,
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          capital: true,
          program: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
} as const;

// GET /api/timesheets/current — get or create current week timesheet
export const GET = withAuth(async (_req, ctx) => {
  const weekStart = getWeekMonday(new Date());

  const timesheet = await prisma.timesheet.upsert({
    where: { userId_weekStart: { userId: ctx.user.id, weekStart } },
    create: { userId: ctx.user.id, weekStart, status: "DRAFT" },
    update: {},
    include: {
      entries: {
        include: ENTRY_INCLUDE,
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
      approvedBy: { select: { id: true, name: true } },
      approvalEvents: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const totalHours = timesheet.entries.reduce((sum, e) => sum + Number(e.hours), 0);
  return ok({ ...timesheet, totalHours });
}, SCOPES.TIMESHEET_READ);
