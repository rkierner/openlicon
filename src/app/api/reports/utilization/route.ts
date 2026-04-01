import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const QuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  managerId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
});

// GET /api/reports/utilization
// Returns per-user utilization: actual hours vs weekly target
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const query = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) return Errors.badRequest("Invalid query", query.error.flatten());

  const { dateFrom, dateTo, managerId, userId } = query.data;

  // Determine which users to include
  let userFilter: { id?: string; managerId?: string } = {};
  if (ctx.user.role === "USER") {
    userFilter = { id: ctx.user.id };
  } else if (ctx.user.role === "MANAGER") {
    userFilter = userId ? { id: userId } : { managerId: ctx.user.id };
  } else {
    // Admin
    if (userId) userFilter = { id: userId };
    else if (managerId) userFilter = { managerId };
  }

  const users = await prisma.user.findMany({
    where: { ...userFilter, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      weeklyTarget: true,
      title: true,
      manager: { select: { id: true, name: true } },
    },
  });

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  // Count working weeks in range
  const weekCount = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000)));

  // Aggregate hours per user
  const hoursByUser = await prisma.timeEntry.groupBy({
    by: ["userId"],
    where: {
      userId: { in: users.map((u) => u.id) },
      date: { gte: from, lte: to },
      status: { in: ["SUBMITTED", "APPROVED"] },
    },
    _sum: { hours: true },
  });

  const hoursMap = Object.fromEntries(
    hoursByUser.map((h) => [h.userId, Number(h._sum.hours ?? 0)])
  );

  const result = users.map((user) => {
    const logged = hoursMap[user.id] ?? 0;
    const target = Number(user.weeklyTarget) * weekCount;
    const utilization = target > 0 ? (logged / target) * 100 : 0;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        manager: user.manager,
      },
      loggedHours: Math.round(logged * 100) / 100,
      targetHours: Math.round(target * 100) / 100,
      utilizationPct: Math.round(utilization * 10) / 10,
      status:
        utilization >= 90
          ? "on_target"
          : utilization >= 70
          ? "below_target"
          : "at_risk",
    };
  });

  return ok(result.sort((a, b) => b.utilizationPct - a.utilizationPct));
}, SCOPES.REPORT_READ);
