import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).optional(),
  managerId: z.string().cuid().nullable().optional(),
  costCenterId: z.string().cuid().nullable().optional(),
  weeklyTarget: z.number().min(0).max(80).optional(),
  isActive: z.boolean().optional(),
});

export const GET = withAuth(async (_req: NextRequest, _ctx, params) => {
  const user = await prisma.user.findUnique({
    where: { id: params?.id },
    include: {
      manager: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true, code: true } },
      reports: { select: { id: true, name: true, title: true } },
      _count: { select: { timeEntries: true, timesheets: true, personalAccessTokens: true } },
    },
  });
  if (!user) return Errors.notFound("User not found");
  return ok(user);
}, SCOPES.USER_READ);

export const PUT = withAuth(async (req: NextRequest, ctx, params) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const user = await prisma.user.update({
    where: { id: params?.id },
    data: parsed.data,
    include: {
      manager: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true, code: true } },
    },
  });
  return ok(user);
}, SCOPES.USER_WRITE);
