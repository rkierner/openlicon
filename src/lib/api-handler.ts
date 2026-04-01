import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { extractBearerToken, validatePAT } from "./pat";
import { hasScope } from "./scopes";
import { Errors } from "./api-response";
import type { User } from "@prisma/client";
import type { Scope } from "./scopes";

export type AuthContext = {
  user: User;
  authType: "session" | "pat";
  patId?: string;
  scopes?: string[]; // only for PAT auth
};

export type ApiHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params?: Record<string, string>
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with authentication.
 * Supports both NextAuth sessions and PAT Bearer tokens.
 *
 * @param handler - The actual route logic
 * @param requiredScope - If provided, PAT tokens must have this scope.
 *                        Session users are trusted to have all scopes for their role.
 */
export function withAuth(
  handler: ApiHandler,
  requiredScope?: Scope
): (req: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
    // Resolve params — Next.js 15 passes params as a Promise
    const resolvedParams = context.params ? await context.params : undefined;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      undefined;

    // ── Try PAT auth first ──────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    const rawToken = extractBearerToken(authHeader);

    if (rawToken) {
      const result = await validatePAT(rawToken, ipAddress);

      if (!result.ok) {
        switch (result.error) {
          case "NOT_FOUND":
            return Errors.unauthorized("Invalid access token");
          case "REVOKED":
            return Errors.unauthorized("Access token has been revoked");
          case "EXPIRED":
            return Errors.unauthorized("Access token has expired");
          case "INACTIVE_USER":
            return Errors.unauthorized("Account is inactive");
        }
      }

      const { user, pat, scopes } = result.data;

      // Check required scope
      if (requiredScope && !hasScope(scopes, requiredScope)) {
        return Errors.scopeRequired(requiredScope);
      }

      return handler(
        req,
        { user, authType: "pat", patId: pat.id, scopes },
        resolvedParams
      );
    }

    // ── Try session auth ────────────────────────────────────────────────────
    const session = await auth();

    if (!session?.user?.id) {
      return Errors.unauthorized();
    }

    // Lazy-load user from DB to get full User object
    const { prisma } = await import("./prisma");
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.isActive) {
      return Errors.unauthorized("Account not found or inactive");
    }

    return handler(req, { user, authType: "session" }, resolvedParams);
  };
}

/**
 * Require admin role. Can be used in addition to withAuth.
 */
export function requireAdmin(ctx: AuthContext): NextResponse | null {
  if (ctx.user.role !== "ADMIN") {
    return Errors.forbidden("Admin role required");
  }
  return null;
}

/**
 * Require manager or admin role.
 */
export function requireManager(ctx: AuthContext): NextResponse | null {
  if (ctx.user.role !== "ADMIN" && ctx.user.role !== "MANAGER") {
    return Errors.forbidden("Manager or Admin role required");
  }
  return null;
}
