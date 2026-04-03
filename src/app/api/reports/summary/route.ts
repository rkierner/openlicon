import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const QuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(["project", "category", "user", "week", "month", "initiative"]).default("project"),
  userId: z.string().optional(),    // comma-separated CUIDs
  projectId: z.string().optional(), // comma-separated CUIDs
  categoryId: z.string().optional(), // comma-separated CUIDs
  status: z.string().optional(),    // comma-separated statuses
  managerId: z.string().cuid().optional(),
});

// GET /api/reports/summary
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const query = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) return Errors.badRequest("Invalid query", query.error.flatten());

  const { dateFrom, dateTo, groupBy, userId, projectId, categoryId, status, managerId } =
    query.data;

  const projectIds = projectId?.split(",").filter(Boolean);
  const categoryIds = categoryId?.split(",").filter(Boolean);
  const userIds = userId?.split(",").filter(Boolean);
  const statuses = status?.split(",").filter(Boolean) as
    | Array<"DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED">
    | undefined;

  // Scope: non-managers see only their own data
  const effectiveUserIds =
    ctx.user.role === "ADMIN" || ctx.user.role === "MANAGER"
      ? userIds
      : [ctx.user.id];

  const where = {
    date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
    ...(effectiveUserIds?.length ? { userId: { in: effectiveUserIds } } : {}),
    ...(projectIds?.length ? { projectId: { in: projectIds } } : {}),
    ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
    ...(statuses?.length ? { status: { in: statuses } } : {}),
    ...(managerId ? { user: { managerId } } : {}),
  };

  // Use raw aggregation for performance
  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, code: true, color: true } },
      category: { select: { id: true, name: true, code: true, color: true } },
      initiative: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // Group in application layer (avoids complex Prisma groupBy with relations)
  const groups: Record<string, { label: string; hours: number; count: number; meta?: unknown }> = {};

  for (const entry of entries) {
    let key: string;
    let label: string;
    let meta: unknown;

    switch (groupBy) {
      case "project":
        key = entry.projectId;
        label = `${entry.project.code} — ${entry.project.name}`;
        meta = entry.project;
        break;
      case "category":
        key = entry.categoryId;
        label = entry.category.name;
        meta = entry.category;
        break;
      case "user":
        key = entry.userId;
        label = entry.user.name;
        meta = { id: entry.user.id, name: entry.user.name, email: entry.user.email };
        break;
      case "initiative":
        key = entry.initiativeId ?? "__none__";
        label = entry.initiative?.name ?? "(No Initiative)";
        meta = entry.initiative;
        break;
      case "week": {
        const d = new Date(entry.date);
        const monday = getWeekMonday(d);
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

    if (!groups[key]) {
      groups[key] = { label, hours: 0, count: 0, meta };
    }
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
