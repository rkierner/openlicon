import { NextRequest } from "next/server";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// GET /api/admin/imports — list import jobs
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok(jobs);
}, SCOPES.ADMIN_READ);

// POST /api/admin/imports — start an import (JSON payload with parsed rows)
// The actual parsing happens client-side via PapaParse
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  if (!body?.type || !body?.filename || !Array.isArray(body?.rows)) {
    return Errors.badRequest("Required: type, filename, rows[]");
  }

  const { type, filename, rows, mapping } = body;
  if (!["USERS", "PROJECTS", "TIME_ENTRIES"].includes(type)) {
    return Errors.badRequest("Invalid type. Must be USERS, PROJECTS, or TIME_ENTRIES");
  }

  // Create the job record
  const job = await prisma.importJob.create({
    data: {
      type,
      filename,
      status: "PENDING",
      totalRows: rows.length,
      createdById: ctx.user.id,
      mappingConfig: mapping ?? null,
    },
  });

  // Queue the import job
  const { repliconImportQueue } = await import("@/jobs/queue");
  await repliconImportQueue.add(`import-${job.id}`, {
    jobId: job.id,
    type,
    rows,
    mapping,
  });

  return created(job);
}, SCOPES.ADMIN_WRITE);
