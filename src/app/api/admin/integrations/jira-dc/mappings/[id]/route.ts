import { withAuth, requireAdmin } from "@/lib/api-handler";
import { noContent, Errors } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { SCOPES } from "@/lib/scopes";

// DELETE — remove a project mapping by ID
export const DELETE = withAuth(async (_req, ctx, params) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const id = params?.id;
  if (!id) return Errors.badRequest("Missing mapping ID");

  const mapping = await prisma.jiraDcProjectMapping.findUnique({ where: { id } });
  if (!mapping) return Errors.notFound("Mapping not found");

  await prisma.jiraDcProjectMapping.delete({ where: { id } });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "JIRA_DC_MAPPING.DELETE",
    entityType: "JiraDcProjectMapping",
    entityId: id,
    changes: { before: { jiraProjectKey: mapping.jiraProjectKey, taskId: mapping.taskId } },
  });

  return noContent();
}, SCOPES.INTEGRATIONS_WRITE);
