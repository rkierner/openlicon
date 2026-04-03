-- AlterEnum
ALTER TYPE "ApprovalAction" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "returnedById" TEXT;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
