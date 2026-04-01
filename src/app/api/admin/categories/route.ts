import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20).toUpperCase(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const GET = withAuth(async () => {
  const cats = await prisma.category.findMany({
    where: { isActive: true },
    include: { _count: { select: { timeEntries: true } } },
    orderBy: { name: "asc" },
  });
  return ok(cats);
}, SCOPES.ADMIN_READ);

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());
  const exists = await prisma.category.findUnique({ where: { code: parsed.data.code } });
  if (exists) return Errors.conflict("Category code already exists");
  const cat = await prisma.category.create({ data: parsed.data });
  return created(cat);
}, SCOPES.ADMIN_WRITE);
