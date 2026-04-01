import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, noContent, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  isShared: z.boolean().optional(),
});

export const GET = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing report ID");

  const report = await prisma.savedReport.findFirst({
    where: { id, OR: [{ userId: ctx.user.id }, { isShared: true }] },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!report) return Errors.notFound("Report not found");
  return ok(report);
}, SCOPES.REPORT_READ);

export const PUT = withAuth(async (req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing report ID");

  const report = await prisma.savedReport.findFirst({
    where: { id, userId: ctx.user.id },
  });
  if (!report) return Errors.notFound("Report not found");

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest("Invalid body", parsed.error.flatten());

  const { config, ...rest } = parsed.data;
  const updated = await prisma.savedReport.update({
    where: { id },
    data: {
      ...rest,
      ...(config !== undefined
        ? { config: config as import("@prisma/client").Prisma.InputJsonValue }
        : {}),
    },
  });
  return ok(updated);
}, SCOPES.REPORT_READ);

export const DELETE = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing report ID");

  const report = await prisma.savedReport.findFirst({
    where: { id, userId: ctx.user.id },
  });
  if (!report) return Errors.notFound("Report not found");

  await prisma.savedReport.delete({ where: { id } });
  return noContent();
}, SCOPES.REPORT_READ);
