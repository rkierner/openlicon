ALTER TABLE "projects" RENAME COLUMN "billable" TO "capital";
ALTER TABLE "projects" ALTER COLUMN "capital" SET DEFAULT false;
