import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// POST /api/timesheets/:id/recall — pull back a submitted timesheet
export const POST = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing timesheet ID");

  const timesheet = await prisma.timesheet.findFirst({
    where: { id, userId: ctx.user.id },
  });

  if (!timesheet) return Errors.notFound("Timesheet not found");
  if (timesheet.status !== "SUBMITTED") {
    return Errors.conflict(`Only submitted timesheets can be recalled (current: ${timesheet.status})`);
  }

  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.timesheet.update({
      where: { id },
      data: { status: "DRAFT", submittedAt: null },
    }),
    prisma.timeEntry.updateMany({
      where: { timesheetId: id, status: "SUBMITTED" },
      data: { status: "DRAFT" },
    }),
    prisma.approvalEvent.create({
      data: {
        timesheetId: id,
        actorId: ctx.user.id,
        action: "RECALLED",
        createdAt: now,
      },
    }),
  ]);

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "TIMESHEET.RECALL",
    entityType: "Timesheet",
    entityId: id,
  });

  return ok(updated);
}, SCOPES.TIMESHEET_SUBMIT);
