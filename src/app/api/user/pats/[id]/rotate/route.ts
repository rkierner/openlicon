import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { generateRawToken, hashToken, extractPrefix } from "@/lib/pat";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// POST /api/user/pats/:id/rotate — atomically create new token + revoke old
export const POST = withAuth(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return Errors.badRequest("Missing token ID");

  const oldPat = await prisma.personalAccessToken.findFirst({
    where: { id, userId: ctx.user.id, revokedAt: null },
  });

  if (!oldPat) return Errors.notFound("Token not found");

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = extractPrefix(rawToken);

  // Atomic: create new + revoke old
  const [newPat] = await prisma.$transaction([
    prisma.personalAccessToken.create({
      data: {
        userId: ctx.user.id,
        name: `${oldPat.name} (rotated)`,
        tokenHash,
        tokenPrefix,
        scopes: oldPat.scopes,
        expiresAt: oldPat.expiresAt,
      },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.personalAccessToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    }),
  ]);

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "PAT.ROTATE",
    entityType: "PersonalAccessToken",
    entityId: id,
    changes: { before: { id }, after: { id: newPat.id } },
  });

  return created({ ...newPat, token: rawToken });
}, SCOPES.PAT_WRITE);
