/**
 * Replicon CSV Import Pipeline
 *
 * Supports three import types:
 * - USERS: map Replicon user fields to TIRP User
 * - PROJECTS: map Replicon project/client fields
 * - TIME_ENTRIES: map Replicon time entry rows
 */

import { prisma } from "@/lib/prisma";

// ─── Column Mappings ──────────────────────────────────────────────────────────

export const DEFAULT_MAPPINGS = {
  users: {
    email: "Email",
    name: "Display Name",
    workdayId: "Employee ID",
    department: "Department",
    title: "Job Title",
    manager: "Manager Email",
  },
  projects: {
    code: "Project Code",
    name: "Project Name",
    billable: "Billable",
    status: "Status",
  },
  timeEntries: {
    userEmail: "User Email",
    date: "Date",
    hours: "Duration",
    projectCode: "Project Code",
    categoryName: "Activity Type",
    notes: "Notes",
    externalId: "Entry ID",
  },
} as const;

// ─── Row Parsers ──────────────────────────────────────────────────────────────

export type ImportResult = {
  processed: number;
  success: number;
  errors: Array<{ row: number; message: string }>;
};

export async function importUsers(
  rows: Record<string, string>[],
  mapping = DEFAULT_MAPPINGS.users
): Promise<ImportResult> {
  const result: ImportResult = { processed: 0, success: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.processed++;

    try {
      const email = row[mapping.email]?.trim().toLowerCase();
      if (!email) throw new Error("Missing email");

      const data = {
        email,
        name: row[mapping.name]?.trim() ?? email,
        workdayId: row[mapping.workdayId]?.trim() || null,
        department: row[mapping.department]?.trim() || null,
        title: row[mapping.title]?.trim() || null,
      };

      await prisma.user.upsert({
        where: { email },
        create: { ...data, passwordHash: "" },
        update: data,
      });
      result.success++;
    } catch (err) {
      result.errors.push({ row: i + 2, message: String(err) });
    }
  }

  return result;
}

export async function importProjects(
  rows: Record<string, string>[],
  mapping = DEFAULT_MAPPINGS.projects
): Promise<ImportResult> {
  const result: ImportResult = { processed: 0, success: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.processed++;

    try {
      const code = row[mapping.code]?.trim().toUpperCase();
      if (!code) throw new Error("Missing project code");

      const data = {
        code,
        name: row[mapping.name]?.trim() ?? code,
        billable: row[mapping.billable]?.toLowerCase() !== "false",
        status: row[mapping.status]?.toLowerCase() === "inactive" ? "ARCHIVED" : "ACTIVE",
      };

      await prisma.project.upsert({
        where: { code },
        create: data,
        update: data,
      });
      result.success++;
    } catch (err) {
      result.errors.push({ row: i + 2, message: String(err) });
    }
  }

  return result;
}

export async function importTimeEntries(
  rows: Record<string, string>[],
  mapping = DEFAULT_MAPPINGS.timeEntries,
  jobId: string
): Promise<ImportResult> {
  const result: ImportResult = { processed: 0, success: 0, errors: [] };

  // Cache lookups
  const userCache = new Map<string, string>(); // email → userId
  const projectCache = new Map<string, string>(); // code → projectId
  const categoryCache = new Map<string, string>(); // name → categoryId

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.processed++;

    try {
      const userEmail = row[mapping.userEmail]?.trim().toLowerCase();
      if (!userEmail) throw new Error("Missing user email");

      const dateStr = row[mapping.date]?.trim();
      if (!dateStr) throw new Error("Missing date");

      const hours = parseFloat(row[mapping.hours] ?? "0");
      if (isNaN(hours) || hours <= 0) throw new Error(`Invalid hours: ${row[mapping.hours]}`);

      const projectCode = row[mapping.projectCode]?.trim().toUpperCase();
      if (!projectCode) throw new Error("Missing project code");

      // Resolve user
      if (!userCache.has(userEmail)) {
        const user = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
        if (!user) throw new Error(`User not found: ${userEmail}`);
        userCache.set(userEmail, user.id);
      }
      const userId = userCache.get(userEmail)!;

      // Resolve project
      if (!projectCache.has(projectCode)) {
        const project = await prisma.project.findUnique({ where: { code: projectCode }, select: { id: true } });
        if (!project) throw new Error(`Project not found: ${projectCode}`);
        projectCache.set(projectCode, project.id);
      }
      const projectId = projectCache.get(projectCode)!;

      // Resolve or create category
      const catName = row[mapping.categoryName]?.trim() ?? "Development";
      if (!categoryCache.has(catName)) {
        const cat = await prisma.category.upsert({
          where: { code: catName.toUpperCase().substring(0, 20) },
          create: { name: catName, code: catName.toUpperCase().substring(0, 20) },
          update: {},
          select: { id: true },
        });
        categoryCache.set(catName, cat.id);
      }
      const categoryId = categoryCache.get(catName)!;

      const externalId = row[mapping.externalId]?.trim() || null;
      const entryDate = new Date(dateStr);

      // Find or create timesheet
      const weekStart = getWeekMonday(entryDate);
      const timesheet = await prisma.timesheet.upsert({
        where: { userId_weekStart: { userId, weekStart } },
        create: { userId, weekStart, status: "APPROVED" },
        update: {},
      });

      const data = {
        userId,
        date: entryDate,
        hours,
        projectId,
        categoryId,
        notes: row[mapping.notes]?.trim() || null,
        status: "APPROVED" as const,
        source: "IMPORT" as const,
        timesheetId: timesheet.id,
        externalId,
      };

      if (externalId) {
        const existing = await prisma.timeEntry.findFirst({
          where: { userId, externalId },
        });
        if (existing) {
          await prisma.timeEntry.update({ where: { id: existing.id }, data });
        } else {
          await prisma.timeEntry.create({ data });
        }
      } else {
        await prisma.timeEntry.create({ data });
      }

      result.success++;

      // Update job progress every 100 rows
      if (result.processed % 100 === 0) {
        await prisma.importJob.update({
          where: { id: jobId },
          data: { processedRows: result.processed, successRows: result.success },
        });
      }
    } catch (err) {
      result.errors.push({ row: i + 2, message: String(err) });
    }
  }

  return result;
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
