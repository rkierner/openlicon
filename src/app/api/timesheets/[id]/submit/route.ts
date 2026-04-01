import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// POST /api/timesheets/:id/submit
export const POST = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing timesheet ID");

  const timesheet = await prisma.timesheet.findFirst({
    where: { id, userId: ctx.user.id },
    include: { _count: { select: { entries: true } } },
  });

  if (!timesheet) return Errors.notFound("Timesheet not found");
  if (timesheet.status !== "DRAFT" && timesheet.status !== "REJECTED") {
    return Errors.conflict(`Cannot submit a timesheet with status: ${timesheet.status}`);
  }
  if (timesheet._count.entries === 0) {
    return Errors.badRequest("Cannot submit an empty timesheet");
  }

  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.timesheet.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: now },
    }),
    prisma.timeEntry.updateMany({
      where: { timesheetId: id, status: "DRAFT" },
      data: { status: "SUBMITTED" },
    }),
    prisma.approvalEvent.create({
      data: {
        timesheetId: id,
        actorId: ctx.user.id,
        action: "SUBMITTED",
        createdAt: now,
      },
    }),
  ]);

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "TIMESHEET.SUBMIT",
    entityType: "Timesheet",
    entityId: id,
  });

  return ok(updated);
}, SCOPES.TIMESHEET_SUBMIT);
