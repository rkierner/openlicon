import { z } from "zod";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { ok, created, Errors } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { SCOPES } from "@/lib/scopes";

const CreateSchema = z.object({
  jiraProjectKey: z
    .string()
    .min(1)
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
  taskId: z.string().cuid("Must be a valid task ID"),
});

// GET — list all project mappings for the active Jira DC connection
export const GET = withAuth(async (_req, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const connection = await prisma.jiraDcConnection.findFirst();
  if (!connection) {
    return ok([]);
  }

  const mappings = await prisma.jiraDcProjectMapping.findMany({
    where: { jiraDcConnectionId: connection.id },
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
  });

  return ok(mappings);
}, SCOPES.INTEGRATIONS_READ);

// POST — create a new project mapping
export const POST = withAuth(async (req, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const connection = await prisma.jiraDcConnection.findFirst();
  if (!connection) {
    return Errors.badRequest("No Jira DC connection configured. Set up the connection first.");
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const { jiraProjectKey, taskId } = parsed.data;

  // Verify the task exists
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return Errors.notFound("Task not found");
  }

  // Check for duplicate key on this connection
  const existing = await prisma.jiraDcProjectMapping.findUnique({
    where: {
      jiraDcConnectionId_jiraProjectKey: {
        jiraDcConnectionId: connection.id,
        jiraProjectKey,
      },
    },
  });
  if (existing) {
    return Errors.conflict(`A mapping for Jira project key "${jiraProjectKey}" already exists`);
  }

  const mapping = await prisma.jiraDcProjectMapping.create({
    data: {
      jiraDcConnectionId: connection.id,
      jiraProjectKey,
      taskId,
    },
    include: {
      task: {
        include: {
          project: {
            include: { program: true },
          },
        },
      },
    },
  });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "JIRA_DC_MAPPING.CREATE",
    entityType: "JiraDcProjectMapping",
    entityId: mapping.id,
    changes: { after: { jiraProjectKey, taskId } },
  });

  return created(mapping);
}, SCOPES.INTEGRATIONS_WRITE);
