import { z } from "zod";
import { withAuth } from "@/lib/api-handler";
import { ok, noContent, Errors } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { audit } from "@/lib/audit";
import { SCOPES } from "@/lib/scopes";

const UpsertSchema = z.object({
  jiraUsername: z.string().min(1, "Jira username is required").max(255),
  pat: z.string().min(1, "Jira Data Center PAT is required"),
  isEnabled: z.boolean().default(true),
});

// GET — returns the current user's Jira DC config (never includes the encrypted PAT)
export const GET = withAuth(async (_req, ctx) => {
  const config = await prisma.userJiraDcConfig.findUnique({
    where: { userId: ctx.user.id },
    select: {
      id: true,
      jiraUsername: true,
      isEnabled: true,
      lastSyncAt: true,
      lastSyncError: true,
      createdAt: true,
      updatedAt: true,
      // encryptedPat intentionally omitted
    },
  });

  return ok(config ?? null);
}, SCOPES.INTEGRATIONS_READ);

// PUT — create or update the current user's Jira DC credentials
export const PUT = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  const { jiraUsername, pat, isEnabled } = parsed.data;
  const encryptedPat = encrypt(pat);

  const config = await prisma.userJiraDcConfig.upsert({
    where: { userId: ctx.user.id },
    create: {
      userId: ctx.user.id,
      jiraUsername,
      encryptedPat,
      isEnabled,
    },
    update: {
      jiraUsername,
      encryptedPat,
      isEnabled,
      // Reset error state when credentials are updated
      lastSyncError: null,
    },
    select: {
      id: true,
      jiraUsername: true,
      isEnabled: true,
      lastSyncAt: true,
      lastSyncError: true,
      updatedAt: true,
    },
  });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "JIRA_DC_USER_CONFIG.UPDATE",
    entityType: "UserJiraDcConfig",
    entityId: config.id,
    changes: { after: { jiraUsername, isEnabled } },
  });

  return ok(config);
}, SCOPES.INTEGRATIONS_WRITE);

// DELETE — removes the current user's Jira DC config entirely
export const DELETE = withAuth(async (_req, ctx) => {
  const existing = await prisma.userJiraDcConfig.findUnique({
    where: { userId: ctx.user.id },
  });

  if (!existing) {
    return noContent();
  }

  await prisma.userJiraDcConfig.delete({ where: { userId: ctx.user.id } });

  audit({
    userId: ctx.user.id,
    patId: ctx.patId,
    action: "JIRA_DC_USER_CONFIG.DELETE",
    entityType: "UserJiraDcConfig",
    entityId: existing.id,
  });

  return noContent();
}, SCOPES.INTEGRATIONS_WRITE);
