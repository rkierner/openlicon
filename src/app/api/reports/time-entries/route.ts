import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { TimeEntryListQuerySchema } from "@/lib/validations/time-entry";

// GET /api/reports/time-entries — full detail with rich filters (for managers/admin)
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const query = TimeEntryListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) return Errors.badRequest("Invalid query", query.error.flatten());

  const { userId, projectId, categoryId, dateFrom, dateTo, status, timesheetId, page, pageSize } =
    query.data;

  const effectiveUserId = ctx.user.role === "USER" ? ctx.user.id : userId;

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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            title: true,
            manager: { select: { id: true, name: true } },
            costCenter: { select: { id: true, name: true, code: true } },
          },
        },
        project: { select: { id: true, name: true, code: true, color: true } },
        initiative: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, code: true, color: true } },
        timesheet: { select: { id: true, weekStart: true, status: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok(entries, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}, SCOPES.REPORT_READ);
