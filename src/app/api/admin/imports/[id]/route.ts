import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// GET /api/admin/imports/:id — get import job status
export const GET = withAuth(async (_req: NextRequest, _ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing job ID");

  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job) return Errors.notFound("Import job not found");

  return ok(job);
}, SCOPES.ADMIN_READ);
