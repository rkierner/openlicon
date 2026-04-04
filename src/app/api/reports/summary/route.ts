import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const QuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(["project", "task", "program", "user", "week", "month"]).default("project"),
  userId: z.string().optional(),    // comma-separated CUIDs
  projectId: z.string().optional(), // comma-separated CUIDs
  programId: z.string().optional(), // comma-separated CUIDs
  status: z.string().optional(),    // comma-separated statuses
  managerId: z.string().cuid().optional(),
});

// GET /api/reports/summary
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const query = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) return Errors.badRequest("Invalid query", query.error.flatten());

  const { dateFrom, dateTo, groupBy, userId, projectId, programId, status, managerId } = query.data;

  const projectIds = projectId?.split(",").filter(Boolean);
  const programIds = programId?.split(",").filter(Boolean);
  const userIds = userId?.split(",").filter(Boolean);
  const statuses = status?.split(",").filter(Boolean) as
    | Array<"DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED">
    | undefined;

  const effectiveUserIds =
    ctx.user.role === "ADMIN" || ctx.user.role === "MANAGER" ? userIds : [ctx.user.id];

  const where = {
    date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
    ...(effectiveUserIds?.length ? { userId: { in: effectiveUserIds } } : {}),
    ...(projectIds?.length ? { task: { projectId: { in: projectIds } } } : {}),
    ...(programIds?.length ? { task: { project: { programId: { in: programIds } } } } : {}),
    ...(statuses?.length ? { status: { in: statuses } } : {}),
    ...(managerId ? { user: { managerId } } : {}),
  };

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      task: {
        select: {
          id: true, name: true, code: true, capitalizable: true,
          project: {
            select: {
              id: true, name: true, code: true, color: true,
              program: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const groups: Record<string, { label: string; hours: number; count: number; meta?: unknown }> = {};

  for (const entry of entries) {
    let key: string;
    let label: string;
    let meta: unknown;

    switch (groupBy) {
      case "project":
        key = entry.task.project.id;
        label = `${entry.task.project.code} — ${entry.task.project.name}`;
        meta = entry.task.project;
        break;
      case "task":
        key = entry.taskId;
        label = entry.task.name;
        meta = entry.task;
        break;
      case "program":
        key = entry.task.project.program?.id ?? "__none__";
        label = entry.task.project.program?.name ?? "(No Program)";
        meta = entry.task.project.program;
        break;
      case "user":
        key = entry.userId;
        label = entry.user.name;
        meta = { id: entry.user.id, name: entry.user.name, email: entry.user.email };
        break;
      case "week": {
        const monday = getWeekMonday(new Date(entry.date));
        key = monday.toISOString().substring(0, 10);
        label = `Week of ${key}`;
        break;
      }
      case "month": {
        const d = new Date(entry.date);
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        label = key;
        break;
      }
    }

    if (!groups[key]) groups[key] = { label, hours: 0, count: 0, meta };
    groups[key].hours += Number(entry.hours);
    groups[key].count++;
  }

  const result = Object.entries(groups)
    .map(([key, value]) => ({ key, ...value, hours: Math.round(value.hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = result.reduce((s, r) => s + r.hours, 0);

  return ok({ groups: result, totalHours: Math.round(totalHours * 100) / 100, entryCount: entries.length });
}, SCOPES.REPORT_READ);

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
