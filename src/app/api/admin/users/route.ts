import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";
import { createHash } from "crypto";

const CreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  title: z.string().optional(),
  department: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).default("USER"),
  managerId: z.string().cuid().optional(),
  costCenterId: z.string().cuid().optional(),
  weeklyTarget: z.number().min(0).max(80).default(40),
  password: z.string().min(8).optional(),
});

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const users = await prisma.user.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      manager: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true, code: true } },
      _count: { select: { reports: true, timeEntries: true } },
    },
    orderBy: { name: "asc" },
  });
  return ok(users);
}, SCOPES.USER_READ);

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return Errors.conflict("Email already exists");

  const { password, ...data } = parsed.data;
  const user = await prisma.user.create({
    data: {
      ...data,
      passwordHash: password
        ? createHash("sha256").update(password).digest("hex")
        : createHash("sha256").update("changeme123").digest("hex"),
    },
    include: {
      manager: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true, code: true } },
    },
  });
  return created(user);
}, SCOPES.USER_WRITE);
