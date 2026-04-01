import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import type { User, PersonalAccessToken } from "@prisma/client";

const TOKEN_PREFIX = "tirp_";

// ─── Token Generation ─────────────────────────────────────────────────────────

/**
 * Generate a new raw PAT token.
 * Format: tirp_ + 40 random hex chars
 * Example: tirp_a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
 */
export function generateRawToken(): string {
  const bytes = randomBytes(20); // 20 bytes = 40 hex chars
  return TOKEN_PREFIX + bytes.toString("hex");
}

/**
 * Hash a raw token for storage (SHA-256).
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Extract display prefix (first 8 chars after "tirp_").
 */
export function extractPrefix(rawToken: string): string {
  return rawToken.replace(TOKEN_PREFIX, "").substring(0, 8);
}

// ─── Token Validation ─────────────────────────────────────────────────────────

export type ValidatedPAT = {
  user: User;
  pat: PersonalAccessToken;
  scopes: string[];
};

export type PATValidationError =
  | "NOT_FOUND"
  | "REVOKED"
  | "EXPIRED"
  | "INACTIVE_USER";

/**
 * Validate a raw token from an Authorization header.
 * Returns the user + PAT on success, or an error code.
 *
 * Usage tracking (lastUsedAt) is updated async without blocking the request.
 */
export async function validatePAT(
  rawToken: string,
  ipAddress?: string
): Promise<{ ok: true; data: ValidatedPAT } | { ok: false; error: PATValidationError }> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const tokenHash = hashToken(rawToken);

  const pat = await prisma.personalAccessToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!pat) return { ok: false, error: "NOT_FOUND" };
  if (pat.revokedAt) return { ok: false, error: "REVOKED" };
  if (pat.expiresAt && pat.expiresAt < new Date()) return { ok: false, error: "EXPIRED" };
  if (!pat.user.isActive) return { ok: false, error: "INACTIVE_USER" };

  // Update usage metadata non-blocking
  prisma.personalAccessToken
    .update({
      where: { id: pat.id },
      data: { lastUsedAt: new Date(), lastUsedIp: ipAddress ?? null },
    })
    .catch(() => {
      // swallow — non-critical
    });

  return {
    ok: true,
    data: {
      user: pat.user,
      pat,
      scopes: pat.scopes,
    },
  };
}

// ─── Token from Request ───────────────────────────────────────────────────────

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1] ?? null;
}
