import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const QuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granularity: z.enum(["day", "week", "month"]).default("week"),
  groupBy: z.enum(["project", "task", "program", "user", "none"]).default("none"),
  userId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
});

// GET /api/reports/time-series
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const query = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) return Errors.badRequest("Invalid query", query.error.flatten());

  const { dateFrom, dateTo, granularity, groupBy, userId, projectId, status } = query.data;

  const effectiveUserId = ctx.user.role !== "USER" ? userId : ctx.user.id;

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      ...(effectiveUserId ? { userId: effectiveUserId } : {}),
      ...(projectId ? { task: { projectId } } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      task: {
        select: {
          id: true, name: true,
          project: {
            select: {
              id: true, name: true, code: true, color: true,
              program: { select: { id: true, name: true } },
            },
          },
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  const bucketKey = (date: Date): string => {
    if (granularity === "day") return date.toISOString().substring(0, 10);
    if (granularity === "week") return getWeekMonday(date).toISOString().substring(0, 10);
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const series: Record<string, Record<string, number>> = {};
  const seriesLabels: Record<string, string> = {};
  const seriesColors: Record<string, string> = {};

  for (const entry of entries) {
    const bucket = bucketKey(new Date(entry.date));
    let seriesKey: string;
    let seriesLabel: string;
    let color: string | undefined;

    switch (groupBy) {
      case "project":
        seriesKey = entry.task.project.id;
        seriesLabel = entry.task.project.code;
        color = entry.task.project.color ?? undefined;
        break;
      case "task":
        seriesKey = entry.taskId;
        seriesLabel = entry.task.name;
        break;
      case "program":
        seriesKey = entry.task.project.program?.id ?? "__none__";
        seriesLabel = entry.task.project.program?.name ?? "(No Program)";
        break;
      case "user":
        seriesKey = entry.userId;
        seriesLabel = entry.user.name;
        break;
      default:
        seriesKey = "total";
        seriesLabel = "Total Hours";
    }

    if (!series[bucket]) series[bucket] = {};
    series[bucket][seriesKey] = (series[bucket][seriesKey] ?? 0) + Number(entry.hours);
    seriesLabels[seriesKey] = seriesLabel;
    if (color) seriesColors[seriesKey] = color;
  }

  const data = Object.entries(series)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  const seriesMeta = Object.entries(seriesLabels).map(([key, label]) => ({
    key,
    label,
    color: seriesColors[key],
  }));

  return ok({ data, series: seriesMeta, granularity });
}, SCOPES.REPORT_READ);

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
