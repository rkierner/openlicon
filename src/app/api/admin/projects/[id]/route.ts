import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  capital: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const project = await prisma.project.findUnique({
    where: { id: params?.id },
    include: { initiatives: true, _count: { select: { timeEntries: true } } },
  });
  if (!project) return Errors.notFound("Project not found");
  return ok(project);
}, SCOPES.ADMIN_READ);

export const PUT = withAuth(async (req: NextRequest, ctx, params) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const project = await prisma.project.update({
    where: { id: params?.id },
    data: parsed.data,
  });
  return ok(project);
}, SCOPES.ADMIN_WRITE);
