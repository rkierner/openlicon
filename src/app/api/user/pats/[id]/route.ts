import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { noContent, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// DELETE /api/user/pats/:id — revoke a token
export const DELETE = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing token ID");

  const pat = await prisma.personalAccessToken.findFirst({
    where: { id, userId: ctx.user.id, revokedAt: null },
  });

  if (!pat) return Errors.notFound("Token not found");

  await prisma.personalAccessToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "PAT.REVOKE",
    entityType: "PersonalAccessToken",
    entityId: id,
  });

  return noContent();
}, SCOPES.PAT_WRITE);
