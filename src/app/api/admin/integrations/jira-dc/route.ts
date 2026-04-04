import { z } from "zod";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { ok, Errors } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { SCOPES } from "@/lib/scopes";

const UpdateSchema = z.object({
  baseUrl: z.string().url("Must be a valid URL").optional(),
  isEnabled: z.boolean().optional(),
});

// GET — returns the Jira DC connection with its project mappings (null if none configured)
export const GET = withAuth(async (_req, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const connection = await prisma.jiraDcConnection.findFirst({
    include: {
      mappings: {
        include: {
          task: {
            include: {
              project: {
                include: { program: true },
              },
            },
          },
        },
        orderBy: { jiraProjectKey: "asc" },
      },
    },
  });

  return ok(connection ?? null);
}, SCOPES.INTEGRATIONS_READ);

// PUT — upsert the Jira DC connection (creates one if none exists)
export const PUT = withAuth(async (req, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const { baseUrl, isEnabled } = parsed.data;

  // Find existing or create
  const existing = await prisma.jiraDcConnection.findFirst();

  let connection;
  if (existing) {
    connection = await prisma.jiraDcConnection.update({
      where: { id: existing.id },
      data: {
        ...(baseUrl !== undefined && { baseUrl }),
        ...(isEnabled !== undefined && { isEnabled }),
      },
    });
  } else {
    if (!baseUrl) {
      return Errors.badRequest("baseUrl is required when creating a new connection");
    }
    connection = await prisma.jiraDcConnection.create({
      data: {
        baseUrl,
        isEnabled: isEnabled ?? false,
      },
    });
  }

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "JIRA_DC_CONFIG.UPDATE",
    entityType: "JiraDcConnection",
    entityId: connection.id,
    changes: { after: { baseUrl: connection.baseUrl, isEnabled: connection.isEnabled } },
  });

  return ok(connection);
}, SCOPES.INTEGRATIONS_WRITE);
