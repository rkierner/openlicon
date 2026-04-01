import { z } from "zod";

export const TimeEntryCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  hours: z.number().min(0.25).max(24),
  projectId: z.string().cuid(),
  initiativeId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid(),
  notes: z.string().max(1000).optional().nullable(),
  // source defaults to MANUAL; agents can pass API/AGENT
  source: z.enum(["MANUAL", "API", "IMPORT", "AGENT"]).optional(),
});

export const TimeEntryUpdateSchema = TimeEntryCreateSchema.partial();

export const TimeEntryBulkSchema = z.object({
  entries: z.array(
    TimeEntryCreateSchema.extend({
      // For idempotency — if provided, upsert by externalId
      externalId: z.string().optional(),
      // Allow overriding userId for admin imports
      userId: z.string().cuid().optional(),
    })
  ).min(1).max(500),
});

export const TimeEntryListQuerySchema = z.object({
  userId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  timesheetId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export type TimeEntryCreate = z.infer<typeof TimeEntryCreateSchema>;
export type TimeEntryUpdate = z.infer<typeof TimeEntryUpdateSchema>;
export type TimeEntryBulk = z.infer<typeof TimeEntryBulkSchema>;
export type TimeEntryListQuery = z.infer<typeof TimeEntryListQuerySchema>;
