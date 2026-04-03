import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const QuerySchema = z.object({
  updatedSince: z.string().datetime().optional(), // for incremental refresh
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(1000),
});

/**
 * GET /api/data/fact-time-entries
 *
 * Power BI-optimized endpoint. Returns flat, denormalized rows
 * matching the vw_fact_time_entries star schema.
 * Supports incremental refresh via `updatedSince` parameter.
 *
 * Requires scope: data:read
 */
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
        project: { select: { id: true, name: true, code: true, capital: true } },
        initiative: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, code: true } },
        timesheet: { select: { id: true, weekStart: true, status: true } },
      },
      orderBy: { date: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Flatten to Power BI star schema format
  const rows = entries.map((te) => ({
    entry_key: te.id,
    date_key: parseInt(te.date.toISOString().substring(0, 10).replace(/-/g, "")),
    entry_date: te.date.toISOString().substring(0, 10),
    user_key: te.userId,
    project_key: te.projectId,
    initiative_key: te.initiativeId,
    category_key: te.categoryId,
    timesheet_key: te.timesheetId,
    hours: Number(te.hours),
    entry_status: te.status,
    entry_source: te.source,
    // Denormalized
    user_name: te.user.name,
    user_email: te.user.email,
    user_department: te.user.department,
    user_title: te.user.title,
    manager_name: te.user.manager?.name ?? null,
    cost_center_name: te.user.costCenter?.name ?? null,
    cost_center_code: te.user.costCenter?.code ?? null,
    project_name: te.project.name,
    project_code: te.project.code,
    is_capital: te.project.capital,
    initiative_name: te.initiative?.name ?? null,
    category_name: te.category.name,
    category_code: te.category.code,
    timesheet_week_start: te.timesheet?.weekStart?.toISOString().substring(0, 10) ?? null,
    timesheet_status: te.timesheet?.status ?? null,
    created_at: te.createdAt.toISOString(),
    updated_at: te.updatedAt.toISOString(),
  }));

  return ok(rows, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}, SCOPES.DATA_READ);
