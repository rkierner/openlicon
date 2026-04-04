import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ok, noContent, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { TimeEntryUpdateSchema } from "@/lib/validations/time-entry";

const TASK_INCLUDE = {
  task: {
    select: {
      id: true,
      name: true,
      code: true,
      capitalizable: true,
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          capital: true,
          program: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
} as const;

// GET /api/time-entries/:id
export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing entry ID");

  const entry = await prisma.timeEntry.findFirst({
    where: {
      id,
      ...(ctx.user.role === "USER" ? { userId: ctx.user.id } : {}),
    },
    include: { ...TASK_INCLUDE, user: { select: { id: true, name: true, email: true } } },
  });

  if (!entry) return Errors.notFound("Time entry not found");
  return ok(entry);
}, SCOPES.TIME_READ);

// PUT /api/time-entries/:id  — only hours and notes are editable post-creation
export const PUT = withAuth(async (req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing entry ID");

  const body = await req.json().catch(() => null);
  const parsed = TimeEntryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const entry = await prisma.timeEntry.findFirst({ where: { id, userId: ctx.user.id } });
  if (!entry) return Errors.notFound("Time entry not found");
  if (entry.status === "SUBMITTED" || entry.status === "APPROVED") {
    return Errors.conflict("Cannot edit a submitted or approved entry");
  }

  const { hours, notes } = parsed.data;

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: {
      ...(hours !== undefined ? { hours } : {}),
      ...(notes !== undefined ? { notes: notes ?? null } : {}),
    },
    include: TASK_INCLUDE,
  });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "TIME_ENTRY.UPDATE",
    entityType: "TimeEntry",
    entityId: id,
    changes: { before: entry, after: updated },
  });

  return ok(updated);
}, SCOPES.TIME_WRITE);

// DELETE /api/time-entries/:id
export const DELETE = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing entry ID");

  const entry = await prisma.timeEntry.findFirst({ where: { id, userId: ctx.user.id } });
  if (!entry) return Errors.notFound("Time entry not found");
  if (entry.status === "SUBMITTED" || entry.status === "APPROVED") {
    return Errors.conflict("Cannot delete a submitted or approved entry");
  }

  await prisma.timeEntry.delete({ where: { id } });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "TIME_ENTRY.DELETE",
    entityType: "TimeEntry",
    entityId: id,
  });

  return noContent();
}, SCOPES.TIME_WRITE);
