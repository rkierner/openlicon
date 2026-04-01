// ─── Scope Definitions ────────────────────────────────────────────────────────
// All valid PAT scopes for TIRP. Keep in sync with API route requirements.

export const SCOPES = {
  // Time entries
  TIME_READ: "time:read",
  TIME_WRITE: "time:write",

  // Timesheets
  TIMESHEET_READ: "timesheet:read",
  TIMESHEET_SUBMIT: "timesheet:submit",
  TIMESHEET_APPROVE: "timesheet:approve",

  // Reports
  REPORT_READ: "report:read",

  // Admin
  ADMIN_READ: "admin:read",
  ADMIN_WRITE: "admin:write",

  // Users
  USER_READ: "user:read",
  USER_WRITE: "user:write",

  // PATs (self-management)
  PAT_READ: "pat:read",
  PAT_WRITE: "pat:write",

  // Power BI / BI data export
  DATA_READ: "data:read",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: Scope[] = Object.values(SCOPES);

// Grouped for UI display
export const SCOPE_GROUPS: { label: string; scopes: Scope[] }[] = [
  {
    label: "Time Entries",
    scopes: [SCOPES.TIME_READ, SCOPES.TIME_WRITE],
  },
  {
    label: "Timesheets",
    scopes: [SCOPES.TIMESHEET_READ, SCOPES.TIMESHEET_SUBMIT, SCOPES.TIMESHEET_APPROVE],
  },
  {
    label: "Reports",
    scopes: [SCOPES.REPORT_READ],
  },
  {
    label: "Data Export (Power BI)",
    scopes: [SCOPES.DATA_READ],
  },
  {
    label: "Users",
    scopes: [SCOPES.USER_READ, SCOPES.USER_WRITE],
  },
  {
    label: "Admin",
    scopes: [SCOPES.ADMIN_READ, SCOPES.ADMIN_WRITE],
  },
  {
    label: "Personal Access Tokens",
    scopes: [SCOPES.PAT_READ, SCOPES.PAT_WRITE],
  },
];

/**
 * Check if a token's scopes satisfy a required scope.
 * Admin tokens implicitly have all non-admin scopes.
 */
export function hasScope(tokenScopes: string[], required: Scope): boolean {
  if (tokenScopes.includes(required)) return true;
  // admin:write implies admin:read
  if (required === SCOPES.ADMIN_READ && tokenScopes.includes(SCOPES.ADMIN_WRITE)) return true;
  // user:write implies user:read
  if (required === SCOPES.USER_READ && tokenScopes.includes(SCOPES.USER_WRITE)) return true;
  // timesheet:approve implies timesheet:read and timesheet:submit
  if (
    (required === SCOPES.TIMESHEET_READ || required === SCOPES.TIMESHEET_SUBMIT) &&
    tokenScopes.includes(SCOPES.TIMESHEET_APPROVE)
  )
    return true;
  return false;
}

export function validateScopes(scopes: string[]): { valid: boolean; invalid: string[] } {
  const invalid = scopes.filter((s) => !ALL_SCOPES.includes(s as Scope));
  return { valid: invalid.length === 0, invalid };
}
