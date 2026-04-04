import { startOfWeek, endOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { JiraDcClient } from "@/lib/integrations/jira-dc/client";

export type JiraDcSyncResult = {
  usersProcessed: number;
  entriesCreated: number;
  entriesUpdated: number;
  entriesSkipped: number;
  errors: Array<{ userId: string; message: string }>;
};

/**
 * Returns the Monday 00:00:00 and Sunday 23:59:59.999 bounds for the current week in UTC.
 */
export function getCurrentWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });     // Sunday
  return { weekStart, weekEnd };
}

/**
 * Main Jira Data Center sync function. Called by the BullMQ worker.
 *
 * For each active user with a Jira DC config, fetches their worklogs for the
 * current week and creates/updates DRAFT TimeEntry records. Entries that have
 * been SUBMITTED or APPROVED are never modified.
 */
export async function runJiraDcSync(opts?: {
  triggeredBy?: string;
}): Promise<JiraDcSyncResult> {
  const result: JiraDcSyncResult = {
    usersProcessed: 0,
    entriesCreated: 0,
    entriesUpdated: 0,
    entriesSkipped: 0,
    errors: [],
  };

  // Load the single active Jira DC connection with its project mappings
  const connection = await prisma.jiraDcConnection.findFirst({
    where: { isEnabled: true },
    include: { mappings: true },
  });

  if (!connection) {
    console.log("[jira-dc-sync] No enabled Jira DC connection found, skipping.");
    return result;
  }

  // Build a fast lookup: uppercase project key -> taskId
  const projectKeyToTaskId = new Map(
    connection.mappings.map((m) => [m.jiraProjectKey.toUpperCase(), m.taskId])
  );

  const { weekStart, weekEnd } = getCurrentWeekBounds();

  // Load all enabled user configs for active users
  const userConfigs = await prisma.userJiraDcConfig.findMany({
    where: { isEnabled: true },
    include: { user: { select: { id: true, isActive: true } } },
  });

  for (const config of userConfigs) {
    if (!config.user.isActive) continue;
    result.usersProcessed++;

    try {
      const plainPat = decrypt(config.encryptedPat);
      const client = new JiraDcClient(connection.baseUrl, plainPat);
      const worklogs = await client.getWeeklyWorklogs(config.jiraUsername, weekStart, weekEnd);

      for (const worklog of worklogs) {
        const taskId = projectKeyToTaskId.get(worklog.projectKey.toUpperCase());
        if (!taskId) {
          result.entriesSkipped++;
          continue;
        }

        const externalId = `jira_dc_worklog_${worklog.id}`;
        const hours = worklog.timeSpentSeconds / 3600;
        const date = new Date(worklog.started);

        const existing = await prisma.timeEntry.findFirst({
          where: { externalId },
        });

        if (existing) {
          // Only update DRAFT entries and only when hours have changed
          if (
            existing.status === "DRAFT" &&
            existing.hours.toNumber() !== parseFloat(hours.toFixed(2))
          ) {
            await prisma.timeEntry.update({
              where: { id: existing.id },
              data: {
                hours: parseFloat(hours.toFixed(2)),
                notes: worklog.comment ?? existing.notes,
              },
            });
            result.entriesUpdated++;
          } else {
            result.entriesSkipped++;
          }
        } else {
          await prisma.timeEntry.create({
            data: {
              userId: config.userId,
              date,
              hours: parseFloat(hours.toFixed(2)),
              taskId,
              notes: worklog.comment ?? null,
              source: "JIRA_DC",
              externalId,
              status: "DRAFT",
            },
          });
          result.entriesCreated++;
        }
      }

      await prisma.userJiraDcConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ userId: config.userId, message });

      await prisma.userJiraDcConfig
        .update({
          where: { id: config.id },
          data: { lastSyncError: message },
        })
        .catch(() => {});
    }
  }

  return result;
}
