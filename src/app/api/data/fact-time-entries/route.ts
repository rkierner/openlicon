import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const QuerySchema = z.object({
  updatedSince: z.string().datetime().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(1000),
});

export const GET = withAuth(async (req: NextRequest, _ctx) => {
  const query = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) return Errors.badRequest("Invalid query", query.error.flatten());

  const { updatedSince, dateFrom, dateTo, page, pageSize } = query.data;

  const where = {
    ...(updatedSince ? { updatedAt: { gte: new Date(updatedSince) } } : {}),
    ...(dateFrom ? { date: { gte: new Date(dateFrom) } } : {}),
    ...(dateTo ? { date: { ...((dateFrom ? { gte: new Date(dateFrom) } : {})), lte: new Date(dateTo) } } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.timeEntry.count({ where }),
    prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, name: true, email: true, department: true, title: true,
            manager: { select: { id: true, name: true } },
            costCenter: { select: { id: true, name: true, code: true } },
            weeklyTarget: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
            code: true,
            capitalizable: true,
            project: {
              select: {
                id: true, name: true, code: true, capital: true,
                program: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        timesheet: { select: { id: true, weekStart: true, status: true } },
      },
      orderBy: { date: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows = entries.map((te) => ({
    entry_key:            te.id,
    date_key:             parseInt(te.date.toISOString().substring(0, 10).replace(/-/g, "")),
    entry_date:           te.date.toISOString().substring(0, 10),
    user_key:             te.userId,
    task_key:             te.taskId,
    project_key:          te.task.project.id,
    program_key:          te.task.project.program?.id ?? null,
    timesheet_key:        te.timesheetId,
    hours:                Number(te.hours),
    entry_status:         te.status,
    entry_source:         te.source,
    // User
    user_name:            te.user.name,
    user_email:           te.user.email,
    user_department:      te.user.department,
    user_title:           te.user.title,
    manager_name:         te.user.manager?.name ?? null,
    cost_center_name:     te.user.costCenter?.name ?? null,
    cost_center_code:     te.user.costCenter?.code ?? null,
    // Task / Project / Program
    task_name:            te.task.name,
    task_code:            te.task.code,
    is_capitalizable:     te.task.capitalizable,
    project_name:         te.task.project.name,
    project_code:         te.task.project.code,
    is_capital:           te.task.project.capital,
    program_name:         te.task.project.program?.name ?? null,
    program_code:         te.task.project.program?.code ?? null,
    // Timesheet
    timesheet_week_start: te.timesheet?.weekStart?.toISOString().substring(0, 10) ?? null,
    timesheet_status:     te.timesheet?.status ?? null,
    created_at:           te.createdAt.toISOString(),
    updated_at:           te.updatedAt.toISOString(),
  }));

  return ok(rows, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}, SCOPES.DATA_READ);
