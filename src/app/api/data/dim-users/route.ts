import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { SCOPES } from "@/lib/scopes";

// GET /api/data/dim-users — Power BI user dimension
export const GET = withAuth(async () => {
  const users = await prisma.user.findMany({
    include: {
      manager: { select: { id: true, name: true, email: true, title: true } },
      costCenter: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = users.map((u) => ({
    user_key: u.id,
    email: u.email,
    full_name: u.name,
    title: u.title,
    department: u.department,
    role: u.role,
    weekly_target_hours: Number(u.weeklyTarget),
    is_active: u.isActive,
    manager_key: u.managerId,
    manager_name: u.manager?.name ?? null,
    manager_email: u.manager?.email ?? null,
    manager_title: u.manager?.title ?? null,
    cost_center_key: u.costCenterId,
    cost_center_name: u.costCenter?.name ?? null,
    cost_center_code: u.costCenter?.code ?? null,
    user_created_at: u.createdAt.toISOString(),
  }));

  return ok(rows);
}, SCOPES.DATA_READ);
