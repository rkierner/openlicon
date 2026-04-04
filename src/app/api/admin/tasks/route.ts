import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const CreateSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(200),
  code: z.string().max(20).optional(),
  description: z.string().optional(),
  capitalizable: z.boolean().default(false),
});

// GET /api/admin/tasks?projectId=xxx
export const GET = withAuth(async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";

  const tasks = await prisma.task.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(!includeInactive ? { isActive: true } : {}),
    },
    include: {
      project: { select: { id: true, name: true, code: true, capital: true } },
      _count: { select: { timeEntries: true } },
    },
    orderBy: { name: "asc" },
  });
  return ok(tasks);
}, SCOPES.ADMIN_READ);

// POST /api/admin/tasks
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project) return Errors.notFound("Project not found");

  // capitalizable only makes sense on capital projects — enforce at API level
  if (parsed.data.capitalizable && !project.capital) {
    return Errors.badRequest("Cannot set capitalizable on a non-capital project");
  }

  const task = await prisma.task.create({ data: parsed.data });
  return created(task);
}, SCOPES.ADMIN_WRITE);
