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
  billable: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const status = req.nextUrl.searchParams.get("status") ?? "ACTIVE";
  const projects = await prisma.project.findMany({
    where: status === "all" ? {} : { status },
    include: { _count: { select: { timeEntries: true, initiatives: true } } },
    orderBy: { name: "asc" },
  });
  return ok(projects);
}, SCOPES.ADMIN_READ);

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const exists = await prisma.project.findUnique({ where: { code: parsed.data.code } });
  if (exists) return Errors.conflict(`Project code '${parsed.data.code}' already exists`);

  const project = await prisma.project.create({ data: parsed.data });
  return created(project);
}, SCOPES.ADMIN_WRITE);
