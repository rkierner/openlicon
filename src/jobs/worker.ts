/**
 * BullMQ Worker Process
 * Run with: npm run worker
 */

import { Worker, Job } from "bullmq";
import { connection, QUEUES } from "./queue";
import { runWorkdayUserSync } from "./workday-sync";
import { importUsers, importProjects, importTimeEntries } from "./replicon-import";
import { runJiraDcSync } from "./jira-dc-sync";
import { prisma } from "@/lib/prisma";

console.log("🔧 TIRP Worker starting...");

// ─── Workday Sync Worker ──────────────────────────────────────────────────────

const workdayWorker = new Worker(
  QUEUES.WORKDAY_SYNC,
  async (job: Job) => {
    console.log(`[workday-sync] Running job ${job.id}`);

    const syncJob = await prisma.syncJob.create({
      data: {
        type: "WORKDAY_USERS",
        status: "RUNNING",
        triggeredBy: job.data.triggeredBy ?? "worker",
        startedAt: new Date(),
      },
    });

    try {
      const result = await runWorkdayUserSync();
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "COMPLETED",
          result,
          completedAt: new Date(),
        },
      });
      console.log(`[workday-sync] Done: ${JSON.stringify(result)}`);
    } catch (err) {
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { status: "FAILED", error: String(err), completedAt: new Date() },
      });
      throw err;
    }
  },
  { connection }
);

// ─── Replicon Import Worker ───────────────────────────────────────────────────

const importWorker = new Worker(
  QUEUES.REPLICON_IMPORT,
  async (job: Job) => {
    const { jobId, type, rows, mapping } = job.data as {
      jobId: string;
      type: "USERS" | "PROJECTS" | "TIME_ENTRIES";
      rows: Record<string, string>[];
      mapping?: Record<string, string>;
    };

    console.log(`[replicon-import] Job ${jobId} — ${type} — ${rows.length} rows`);

    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date(), totalRows: rows.length },
    });

    try {
      let result;
      if (type === "USERS") {
        result = await importUsers(rows, mapping as never);
      } else if (type === "PROJECTS") {
        result = await importProjects(rows, mapping as never);
      } else {
        result = await importTimeEntries(rows, mapping as never, jobId);
      }

      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          processedRows: result.processed,
          successRows: result.success,
          errorRows: result.errors.length,
          errors: result.errors,
          completedAt: new Date(),
        },
      });

      console.log(`[replicon-import] Done: ${result.success}/${result.processed} rows`);
    } catch (err) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errors: [{ message: String(err) }], completedAt: new Date() },
      });
      throw err;
    }
  },
  { connection }
);

// ─── Token Cleanup Worker ─────────────────────────────────────────────────────

const tokenCleanupWorker = new Worker(
  QUEUES.TOKEN_CLEANUP,
  async () => {
    const result = await prisma.personalAccessToken.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    console.log(`[token-cleanup] Marked ${result.count} expired tokens as revoked`);
  },
  { connection }
);

// ─── Jira Data Center Sync Worker ────────────────────────────────────────────

const jiraDcSyncWorker = new Worker(
  QUEUES.JIRA_DC_SYNC,
  async (job: Job) => {
    console.log(`[jira-dc-sync] Running job ${job.id}`);

    const connection2 = await prisma.jiraDcConnection.findFirst({
      where: { isEnabled: true },
      select: { id: true },
    });

    if (!connection2) {
      console.log("[jira-dc-sync] No enabled Jira DC connection, skipping.");
      return;
    }

    const syncLog = await prisma.jiraDcSyncLog.create({
      data: {
        jiraDcConnectionId: connection2.id,
        status: "RUNNING",
        triggeredBy: job.data.triggeredBy ?? "scheduled",
        startedAt: new Date(),
      },
    });

    try {
      const result = await runJiraDcSync({ triggeredBy: job.data.triggeredBy });
      await prisma.jiraDcSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "COMPLETED",
          usersProcessed: result.usersProcessed,
          entriesCreated: result.entriesCreated,
          entriesUpdated: result.entriesUpdated,
          entriesSkipped: result.entriesSkipped,
          errors: result.errors.length > 0 ? result.errors : undefined,
          completedAt: new Date(),
        },
      });
      console.log(
        `[jira-dc-sync] Done: created=${result.entriesCreated} updated=${result.entriesUpdated} skipped=${result.entriesSkipped} errors=${result.errors.length}`
      );
    } catch (err) {
      await prisma.jiraDcSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "FAILED",
          errors: [{ message: String(err) }],
          completedAt: new Date(),
        },
      });
      throw err;
    }
  },
  { connection }
);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all([
    workdayWorker.close(),
    importWorker.close(),
    tokenCleanupWorker.close(),
    jiraDcSyncWorker.close(),
  ]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Schedule recurring jobs ──────────────────────────────────────────────────

import { workdaySyncQueue, tokenCleanupQueue, jiraDcSyncQueue } from "./queue";

// Workday sync every night at 2am
workdaySyncQueue.add("scheduled-sync", {}, {
  repeat: { pattern: "0 2 * * *" },
  removeOnComplete: 10,
  removeOnFail: 5,
});

// Token cleanup daily
tokenCleanupQueue.add("daily-cleanup", {}, {
  repeat: { pattern: "0 3 * * *" },
  removeOnComplete: 5,
  removeOnFail: 5,
});

// Jira Data Center sync — every hour
jiraDcSyncQueue.add("hourly-sync", {}, {
  repeat: { pattern: "0 * * * *" },
  removeOnComplete: 24,
  removeOnFail: 10,
});

console.log("✅ Workers running. Listening for jobs...");
