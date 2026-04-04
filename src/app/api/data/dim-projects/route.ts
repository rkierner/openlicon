import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// GET /api/data/dim-projects — Power BI project dimension
export const GET = withAuth(async () => {
  const projects = await prisma.project.findMany({
    include: {
      program: { select: { id: true, name: true, code: true } },
      tasks: { where: { isActive: true }, select: { id: true, name: true, capitalizable: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = projects.map((p) => ({
    project_key:        p.id,
    project_name:       p.name,
    project_code:       p.code,
    project_status:     p.status,
    is_capital:         p.capital,
    project_color:      p.color,
    program_key:        p.program?.id ?? null,
    program_name:       p.program?.name ?? null,
    program_code:       p.program?.code ?? null,
    task_count:         p.tasks.length,
    project_created_at: p.createdAt.toISOString(),
  }));

  return ok(rows);
}, SCOPES.DATA_READ);
