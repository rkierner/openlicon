-- ─── New tables ───────────────────────────────────────────────────────────────

CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "capitalizable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- ─── Extend projects with programId ───────────────────────────────────────────

ALTER TABLE "projects" ADD COLUMN "programId" TEXT;
CREATE INDEX "projects_programId_idx" ON "projects"("programId");

-- ─── Data migration ───────────────────────────────────────────────────────────

-- Seed a default program and attach all existing projects to it
INSERT INTO "programs" ("id", "name", "code", "isActive", "createdAt", "updatedAt")
VALUES ('cldefaultprogram00000000', 'Default Program', 'DEFAULT', true, NOW(), NOW());

UPDATE "projects" SET "programId" = 'cldefaultprogram00000000';

-- Build a stable mapping: one generated task id per unique (project, category, initiative) combo
CREATE TEMP TABLE _task_map AS
SELECT
    gen_random_uuid()::text                          AS task_id,
    te."projectId"                                   AS project_id,
    te."categoryId"                                  AS category_id,
    te."initiativeId"                                AS initiative_id,
    CASE
        WHEN ini.name IS NOT NULL THEN cat.name || ' / ' || ini.name
        ELSE cat.name
    END                                              AS task_name
FROM (
    SELECT DISTINCT "projectId", "categoryId", "initiativeId"
    FROM time_entries
) te
JOIN categories  cat ON cat.id = te."categoryId"
LEFT JOIN initiatives ini ON ini.id = te."initiativeId";

-- Insert tasks
INSERT INTO "tasks" ("id", "projectId", "name", "capitalizable", "isActive", "createdAt", "updatedAt")
SELECT task_id, project_id, task_name, false, true, NOW(), NOW()
FROM _task_map;

-- ─── Restructure time_entries ─────────────────────────────────────────────────

ALTER TABLE "time_entries" ADD COLUMN "taskId" TEXT;

UPDATE time_entries te
SET "taskId" = m.task_id
FROM _task_map m
WHERE te."projectId"  = m.project_id
  AND te."categoryId" = m.category_id
  AND (
      (te."initiativeId" IS NULL AND m.initiative_id IS NULL)
      OR te."initiativeId" = m.initiative_id
  );

ALTER TABLE "time_entries" ALTER COLUMN "taskId" SET NOT NULL;

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_entries"
    ADD CONSTRAINT "time_entries_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
    ADD CONSTRAINT "projects_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Remove old time_entries columns ──────────────────────────────────────────

ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_projectId_fkey";
ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_categoryId_fkey";
ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_initiativeId_fkey";
DROP INDEX IF EXISTS "time_entries_projectId_idx";

ALTER TABLE "time_entries" DROP COLUMN "projectId";
ALTER TABLE "time_entries" DROP COLUMN "categoryId";
ALTER TABLE "time_entries" DROP COLUMN "initiativeId";

-- ─── Drop old tables ──────────────────────────────────────────────────────────

DROP TABLE "initiatives";
DROP TABLE "categories";
