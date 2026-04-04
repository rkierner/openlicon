-- AlterEnum
ALTER TYPE "EntrySource" ADD VALUE 'JIRA_DC';

-- AlterEnum
ALTER TYPE "SyncType" ADD VALUE 'JIRA_DC_SYNC';

-- AlterTable
ALTER TABLE "programs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "jira_dc_connections" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jira_dc_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_dc_project_mappings" (
    "id" TEXT NOT NULL,
    "jiraDcConnectionId" TEXT NOT NULL,
    "jiraProjectKey" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jira_dc_project_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_jira_dc_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jiraUsername" TEXT NOT NULL,
    "encryptedPat" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_jira_dc_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_dc_sync_logs" (
    "id" TEXT NOT NULL,
    "jiraDcConnectionId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" TEXT,
    "usersProcessed" INTEGER NOT NULL DEFAULT 0,
    "entriesCreated" INTEGER NOT NULL DEFAULT 0,
    "entriesUpdated" INTEGER NOT NULL DEFAULT 0,
    "entriesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jira_dc_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jira_dc_project_mappings_jiraDcConnectionId_idx" ON "jira_dc_project_mappings"("jiraDcConnectionId");

-- CreateIndex
CREATE INDEX "jira_dc_project_mappings_taskId_idx" ON "jira_dc_project_mappings"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "jira_dc_project_mappings_jiraDcConnectionId_jiraProjectKey_key" ON "jira_dc_project_mappings"("jiraDcConnectionId", "jiraProjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_jira_dc_configs_userId_key" ON "user_jira_dc_configs"("userId");

-- CreateIndex
CREATE INDEX "user_jira_dc_configs_userId_idx" ON "user_jira_dc_configs"("userId");

-- CreateIndex
CREATE INDEX "jira_dc_sync_logs_jiraDcConnectionId_status_idx" ON "jira_dc_sync_logs"("jiraDcConnectionId", "status");

-- CreateIndex
CREATE INDEX "jira_dc_sync_logs_createdAt_idx" ON "jira_dc_sync_logs"("createdAt");

-- CreateIndex
CREATE INDEX "time_entries_taskId_idx" ON "time_entries"("taskId");

-- AddForeignKey
ALTER TABLE "jira_dc_project_mappings" ADD CONSTRAINT "jira_dc_project_mappings_jiraDcConnectionId_fkey" FOREIGN KEY ("jiraDcConnectionId") REFERENCES "jira_dc_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_dc_project_mappings" ADD CONSTRAINT "jira_dc_project_mappings_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_jira_dc_configs" ADD CONSTRAINT "user_jira_dc_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_dc_sync_logs" ADD CONSTRAINT "jira_dc_sync_logs_jiraDcConnectionId_fkey" FOREIGN KEY ("jiraDcConnectionId") REFERENCES "jira_dc_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
