import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-handler";
import { generateRawToken, hashToken, extractPrefix } from "@/lib/pat";
import { validateScopes } from "@/lib/scopes";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ok, created, Errors } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

const CreatePATSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/user/pats — list my tokens (never shows hash)
export const GET = withAuth(async (_req, ctx) => {
  const pats = await prisma.personalAccessToken.findMany({
    where: {
      userId: ctx.user.id,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      lastUsedIp: true,
      createdAt: true,
    },
  });

  return ok(pats);
}, SCOPES.PAT_READ);

// POST /api/user/pats — create a new token (returns plaintext ONCE)
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => null);
  const parsed = CreatePATSchema.safeParse(body);

  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const { name, scopes, expiresAt } = parsed.data;

  // Validate scopes
  const { valid, invalid } = validateScopes(scopes);
  if (!valid) {
    return Errors.badRequest(`Invalid scopes: ${invalid.join(", ")}`);
  }

  // Non-admins cannot create tokens with admin scopes
  if (ctx.user.role !== "ADMIN" && (scopes.includes("admin:read") || scopes.includes("admin:write"))) {
    return Errors.forbidden("Only admins can create tokens with admin scopes");
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = extractPrefix(rawToken);

  const pat = await prisma.personalAccessToken.create({
    data: {
      userId: ctx.user.id,
      name,
      tokenHash,
      tokenPrefix,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "PAT.CREATE",
    entityType: "PersonalAccessToken",
    entityId: pat.id,
  });

  // Return the raw token ONCE — never stored
  return created({ ...pat, token: rawToken });
}, SCOPES.PAT_WRITE);
