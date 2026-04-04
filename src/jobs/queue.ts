import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const QUEUES = {
  WORKDAY_SYNC: "workday-sync",
  REPLICON_IMPORT: "replicon-import",
  TOKEN_CLEANUP: "token-cleanup",
  TIMESHEET_REMINDER: "timesheet-reminder",
  JIRA_DC_SYNC: "jira-dc-sync",
} as const;

export const workdaySyncQueue = new Queue(QUEUES.WORKDAY_SYNC, { connection });
export const repliconImportQueue = new Queue(QUEUES.REPLICON_IMPORT, { connection });
export const tokenCleanupQueue = new Queue(QUEUES.TOKEN_CLEANUP, { connection });
export const jiraDcSyncQueue = new Queue(QUEUES.JIRA_DC_SYNC, { connection });

export { connection };
