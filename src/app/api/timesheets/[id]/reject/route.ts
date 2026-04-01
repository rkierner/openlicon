import { NextRequest } from "next/server";
import { withAuth, requireManager } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const Schema = z.object({ notes: z.string().max(500).optional() });

// POST /api/timesheets/:id/reject
export const POST = withAuth(async (req: NextRequest, ctx, params) => {
  const guard = requireManager(ctx);
  if (guard) return guard;

  const id = params?.id;
  if (!id) return Errors.badRequest("Missing timesheet ID");

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);

  const timesheet = await prisma.timesheet.findUnique({ where: { id } });
  if (!timesheet) return Errors.notFound("Timesheet not found");
  if (timesheet.status !== "SUBMITTED") {
    return Errors.conflict(`Cannot reject a timesheet with status: ${timesheet.status}`);
  }

  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.timesheet.update({
      where: { id },
      data: { status: "REJECTED" },
    }),
    prisma.timeEntry.updateMany({
      where: { timesheetId: id, status: "SUBMITTED" },
      data: { status: "DRAFT" },
    }),
    prisma.approvalEvent.create({
      data: {
        timesheetId: id,
        actorId: ctx.user.id,
        action: "REJECTED",
        notes: parsed.success ? parsed.data.notes : undefined,
        createdAt: now,
      },
    }),
  ]);

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "TIMESHEET.REJECT",
    entityType: "Timesheet",
    entityId: id,
  });

  return ok(updated);
}, SCOPES.TIMESHEET_APPROVE);
