import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import {
  TimeEntryCreateSchema,
  TimeEntryListQuerySchema,
} from "@/lib/validations/time-entry";

const TASK_INCLUDE = {
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

// GET /api/time-entries
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const query = TimeEntryListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) {
    return Errors.badRequest("Invalid query parameters", query.error.flatten());
  }

  const { userId, taskId, projectId, dateFrom, dateTo, status, timesheetId, page, pageSize } =
    query.data;

  const effectiveUserId =
    ctx.user.role === "ADMIN" || ctx.user.role === "MANAGER" ? userId : ctx.user.id;

  const where = {
    ...(effectiveUserId ? { userId: effectiveUserId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(projectId ? { task: { projectId } } : {}),
    ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" } : {}),
    ...(timesheetId ? { timesheetId } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.timeEntry.count({ where }),
    prisma.timeEntry.findMany({
      where,
      include: { ...TASK_INCLUDE, user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok(entries, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}, SCOPES.TIME_READ);

// POST /api/time-entries
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null);
  const parsed = TimeEntryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const { date, hours, taskId, notes, source } = parsed.data;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return Errors.notFound("Task not found");
  if (!task.isActive) return Errors.badRequest("Task is inactive");
  if (task.project.status !== "ACTIVE") return Errors.badRequest("Project is archived");

  const entryDate = new Date(date);
  const weekStart = getWeekMonday(entryDate);

  const timesheet = await prisma.timesheet.upsert({
    where: { userId_weekStart: { userId: ctx.user.id, weekStart } },
    create: { userId: ctx.user.id, weekStart, status: "DRAFT" },
    update: {},
  });

  if (timesheet.status === "SUBMITTED" || timesheet.status === "APPROVED") {
    return Errors.conflict(
      "Cannot add entries to a submitted or approved timesheet. Recall the timesheet first."
    );
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId: ctx.user.id,
      date: entryDate,
      hours,
      taskId,
      notes: notes ?? null,
      status: "DRAFT",
      source: source ?? "MANUAL",
      timesheetId: timesheet.id,
    },
    include: TASK_INCLUDE,
  });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "TIME_ENTRY.CREATE",
    entityType: "TimeEntry",
    entityId: entry.id,
    changes: { after: { hours, date, taskId } },
  });

  return created(entry);
}, SCOPES.TIME_WRITE);

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
