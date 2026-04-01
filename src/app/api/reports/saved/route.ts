import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  config: z.record(z.unknown()),
  isShared: z.boolean().default(false),
});

export const GET = withAuth(async (_req, ctx) => {
  const reports = await prisma.savedReport.findMany({
    where: {
      OR: [{ userId: ctx.user.id }, { isShared: true }],
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return ok(reports);
}, SCOPES.REPORT_READ);

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const report = await prisma.savedReport.create({
    data: {
      userId: ctx.user.id,
      name: parsed.data.name,
      isShared: parsed.data.isShared ?? false,
      config: parsed.data.config as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
  return created(report);
}, SCOPES.REPORT_READ);
