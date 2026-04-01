import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const QuerySchema = z.object({
  userId: z.string().cuid().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// GET /api/timesheets — list timesheets
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const query = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) return Errors.badRequest("Invalid query", query.error.flatten());

  const { userId, status, weekStart, weekEnd, page, pageSize } = query.data;

  // Managers/admins can see their team; users only themselves
  const effectiveUserId =
    ctx.user.role === "ADMIN" ? userId : ctx.user.role === "MANAGER"
      ? userId // manager can pass specific userId or leave blank for their team
      : ctx.user.id;

  const where = {
    ...(effectiveUserId ? { userId: effectiveUserId } : {}),
    ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" } : {}),
    ...(weekStart || weekEnd
      ? {
          weekStart: {
            ...(weekStart ? { gte: new Date(weekStart) } : {}),
            ...(weekEnd ? { lte: new Date(weekEnd) } : {}),
          },
        }
      : {}),
    // Managers see timesheets of their direct reports if no userId specified
    ...(ctx.user.role === "MANAGER" && !userId
      ? {
          user: {
            managerId: ctx.user.id,
          },
        }
      : {}),
  };

  const [total, timesheets] = await Promise.all([
    prisma.timesheet.count({ where }),
    prisma.timesheet.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ weekStart: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok(timesheets, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}, SCOPES.TIMESHEET_READ);
