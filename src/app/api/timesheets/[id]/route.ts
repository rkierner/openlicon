import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// GET /api/timesheets/:id
export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing timesheet ID");

  const timesheet = await prisma.timesheet.findFirst({
    where: {
      id,
      ...(ctx.user.role === "USER" ? { userId: ctx.user.id } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      entries: {
        include: {
          project: { select: { id: true, name: true, code: true, color: true } },
          initiative: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, code: true, color: true } },
        },
        orderBy: [{ date: "asc" }],
      },
      approvalEvents: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!timesheet) return Errors.notFound("Timesheet not found");

  const totalHours = timesheet.entries.reduce(
    (sum, e) => sum + Number(e.hours),
    0
  );

  return ok({ ...timesheet, totalHours });
}, SCOPES.TIMESHEET_READ);
