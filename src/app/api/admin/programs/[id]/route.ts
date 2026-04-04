import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/programs/:id
export const GET = withAuth(async (_req: NextRequest, _ctx, params) => {
  const program = await prisma.program.findUnique({
    where: { id: params?.id },
    include: {
      projects: {
        include: { _count: { select: { tasks: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!program) return Errors.notFound("Program not found");
  return ok(program);
}, SCOPES.ADMIN_READ);

// PUT /api/admin/programs/:id
export const PUT = withAuth(async (req: NextRequest, ctx, params) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const program = await prisma.program.update({
    where: { id: params?.id },
    data: parsed.data,
  });
  return ok(program);
}, SCOPES.ADMIN_WRITE);
