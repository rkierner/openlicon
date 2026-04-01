import { prisma } from "./prisma";

export type AuditAction =
  | "TIME_ENTRY.CREATE"
  | "TIME_ENTRY.UPDATE"
  | "TIME_ENTRY.DELETE"
  | "TIMESHEET.SUBMIT"
  | "TIMESHEET.APPROVE"
  | "TIMESHEET.REJECT"
  | "TIMESHEET.RECALL"
  | "PAT.CREATE"
  | "PAT.REVOKE"
  | "PAT.ROTATE"
  | "USER.CREATE"
  | "USER.UPDATE"
  | "USER.DEACTIVATE"
  | "PROJECT.CREATE"
  | "PROJECT.UPDATE"
  | "IMPORT.START"
  | "IMPORT.COMPLETE"
  | "SYNC.START"
  | "SYNC.COMPLETE";

export async function audit(params: {
  userId?: string;
  patId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: { before?: unknown; after?: unknown };
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  // Fire-and-forget — don't let audit failures block the request
  prisma.auditLog
    .create({
      data: {
        userId: params.userId ?? null,
        patId: params.patId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes ? (params.changes as import("@prisma/client").Prisma.InputJsonValue) : undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
    .catch((err) => {
      console.error("[audit] Failed to write audit log:", err);
    });
}
