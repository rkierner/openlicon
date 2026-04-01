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

// GET /api/time-entries
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { searchParams } = req.nextUrl;
  const query = TimeEntryListQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!query.success) {
    return Errors.badRequest("Invalid query parameters", query.error.flatten());
  }

  const { userId, projectId, categoryId, dateFrom, dateTo, status, timesheetId, page, pageSize } =
    query.data;

  // Non-admins/managers can only see their own entries
  const effectiveUserId =
    ctx.user.role === "ADMIN" || ctx.user.role === "MANAGER"
      ? userId
      : ctx.user.id;

  const where = {
    ...(effectiveUserId ? { userId: effectiveUserId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(categoryId ? { categoryId } : {}),
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
      include: {
        project: { select: { id: true, name: true, code: true, color: true } },
        initiative: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, code: true, color: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok(entries, {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}, SCOPES.TIME_READ);

// POST /api/time-entries
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null);
  const parsed = TimeEntryCreateSchema.safeParse(body);

  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const { date, hours, projectId, initiativeId, categoryId, notes, source } = parsed.data;

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return Errors.notFound("Project not found");
  if (project.status !== "ACTIVE") return Errors.badRequest("Project is archived");

  // Verify category exists
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return Errors.notFound("Category not found");

  // Find or create timesheet for this week
  const entryDate = new Date(date);
  const weekStart = getWeekMonday(entryDate);

  const timesheet = await prisma.timesheet.upsert({
    where: { userId_weekStart: { userId: ctx.user.id, weekStart } },
    create: { userId: ctx.user.id, weekStart, status: "DRAFT" },
    update: {},
  });

  // Cannot add entries to a submitted/approved timesheet
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
      projectId,
      initiativeId: initiativeId ?? null,
      categoryId,
      notes: notes ?? null,
      status: "DRAFT",
      source: source ?? "MANUAL",
      timesheetId: timesheet.id,
    },
    include: {
      project: { select: { id: true, name: true, code: true, color: true } },
      initiative: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, code: true, color: true } },
    },
  });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "TIME_ENTRY.CREATE",
    entityType: "TimeEntry",
    entityId: entry.id,
    changes: { after: { hours, date, projectId, categoryId } },
  });

  return created(entry);
}, SCOPES.TIME_WRITE);

// ─── Helper ───────────────────────────────────────────────────────────────────

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon = 1
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
