import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { TimeEntryBulkSchema } from "@/lib/validations/time-entry";

/**
 * POST /api/time-entries/bulk
 *
 * Idempotent bulk upsert. Each entry may include an externalId for
 * idempotency (safe for agent/automation re-runs).
 *
 * If externalId is provided: upsert by (userId, externalId).
 * If not: upsert by (userId, date, taskId).
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null);
  const parsed = TimeEntryBulkSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const { entries } = parsed.data;
  const isAdmin = ctx.user.role === "ADMIN";

  const results = {
    created: 0,
    updated: 0,
    errors: [] as { index: number; message: string }[],
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const effectiveUserId = isAdmin && entry.userId ? entry.userId : ctx.user.id;
      const entryDate = new Date(entry.date);

      const weekStart = getWeekMonday(entryDate);
      const timesheet = await prisma.timesheet.upsert({
        where: { userId_weekStart: { userId: effectiveUserId, weekStart } },
        create: { userId: effectiveUserId, weekStart, status: "DRAFT" },
        update: {},
      });

      if (timesheet.status === "SUBMITTED" || timesheet.status === "APPROVED") {
        results.errors.push({ index: i, message: "Timesheet is already submitted/approved" });
        continue;
      }

      const data = {
        userId: effectiveUserId,
        date: entryDate,
        hours: entry.hours,
        taskId: entry.taskId,
        notes: entry.notes ?? null,
        source: entry.source ?? "API",
        status: "DRAFT" as const,
        timesheetId: timesheet.id,
        externalId: entry.externalId ?? null,
      };

      if (entry.externalId) {
        const existing = await prisma.timeEntry.findFirst({
          where: { userId: effectiveUserId, externalId: entry.externalId },
        });
        if (existing) {
          await prisma.timeEntry.update({ where: { id: existing.id }, data });
          results.updated++;
        } else {
          await prisma.timeEntry.create({ data });
          results.created++;
        }
      } else {
        const existing = await prisma.timeEntry.findFirst({
          where: { userId: effectiveUserId, date: entryDate, taskId: entry.taskId, status: "DRAFT" },
        });
        if (existing) {
          await prisma.timeEntry.update({ where: { id: existing.id }, data });
          results.updated++;
        } else {
          await prisma.timeEntry.create({ data });
          results.created++;
        }
      }
    } catch (err) {
      results.errors.push({ index: i, message: String(err) });
    }
  }

  return ok(results);
}, SCOPES.TIME_WRITE);

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
