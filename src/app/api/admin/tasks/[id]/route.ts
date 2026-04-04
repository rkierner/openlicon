import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(20).optional().nullable(),
  description: z.string().optional().nullable(),
  capitalizable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/tasks/:id
export const GET = withAuth(async (_req: NextRequest, _ctx, params) => {
  const task = await prisma.task.findUnique({
    where: { id: params?.id },
    include: {
      project: { select: { id: true, name: true, code: true, capital: true } },
      _count: { select: { timeEntries: true } },
    },
  });
  if (!task) return Errors.notFound("Task not found");
  return ok(task);
}, SCOPES.ADMIN_READ);

// PUT /api/admin/tasks/:id
export const PUT = withAuth(async (req: NextRequest, ctx, params) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  if (parsed.data.capitalizable) {
    const task = await prisma.task.findUnique({
      where: { id: params?.id },
      include: { project: true },
    });
    if (!task) return Errors.notFound("Task not found");
    if (!task.project.capital) {
      return Errors.badRequest("Cannot set capitalizable on a non-capital project");
    }
  }

  const task = await prisma.task.update({
    where: { id: params?.id },
    data: parsed.data,
  });
  return ok(task);
}, SCOPES.ADMIN_WRITE);
