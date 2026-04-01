import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().cuid().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const GET = withAuth(async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;
  const initiatives = await prisma.initiative.findMany({
    where: { ...(projectId ? { projectId } : {}), isActive: true },
    include: { project: { select: { id: true, name: true, code: true } } },
    orderBy: { name: "asc" },
  });
  return ok(initiatives);
}, SCOPES.ADMIN_READ);

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());
  const initiative = await prisma.initiative.create({ data: parsed.data });
  return created(initiative);
}, SCOPES.ADMIN_WRITE);
