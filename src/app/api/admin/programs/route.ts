import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20).toUpperCase(),
  description: z.string().optional(),
});

// GET /api/admin/programs
export const GET = withAuth(async (_req: NextRequest) => {
  const programs = await prisma.program.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });
  return ok(programs);
}, SCOPES.ADMIN_READ);

// POST /api/admin/programs
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const exists = await prisma.program.findUnique({ where: { code: parsed.data.code } });
  if (exists) return Errors.conflict(`Program code '${parsed.data.code}' already exists`);

  const program = await prisma.program.create({ data: parsed.data });
  return created(program);
}, SCOPES.ADMIN_WRITE);
