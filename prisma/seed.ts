import { PrismaClient, Role, EntryStatus, EntrySource, JobStatus } from "@prisma/client";
import { createHash } from "crypto";
import {
  startOfWeek,
  addWeeks,
  addDays,
  format,
  subMonths,
  eachWeekOfInterval,
  isWeekend,
} from "date-fns";

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomHours(): number {
  const values = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
  return values[Math.floor(Math.random() * values.length)];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWeekMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

// ─── Reference Data ───────────────────────────────────────────────────────────

const COST_CENTERS = [
  { name: "Engineering", code: "ENG" },
  { name: "Product", code: "PROD" },
  { name: "Design", code: "DSN" },
  { name: "Operations", code: "OPS" },
  { name: "Data & Analytics", code: "DATA" },
];

const PROJECTS = [
  { name: "Platform API", code: "PLAT", color: "#6366f1", billable: true },
  { name: "Data Pipeline", code: "DATA", color: "#8b5cf6", billable: true },
  { name: "Customer Portal", code: "CUST", color: "#06b6d4", billable: true },
  { name: "Mobile App", code: "MOB", color: "#10b981", billable: true },
  { name: "Internal Tools", code: "INT", color: "#f59e0b", billable: false },
  { name: "Infrastructure", code: "INFRA", color: "#ef4444", billable: true },
  { name: "Analytics Dashboard", code: "ANLYT", color: "#ec4899", billable: true },
  { name: "Authentication Service", code: "AUTH", color: "#14b8a6", billable: true },
  { name: "Notification System", code: "NOTIF", color: "#f97316", billable: true },
  { name: "Search & Discovery", code: "SRCH", color: "#84cc16", billable: true },
  { name: "Payment Integration", code: "PAY", color: "#a855f7", billable: true },
  { name: "DevOps & CI/CD", code: "DEVOPS", color: "#64748b", billable: false },
];

const INITIATIVES_BY_PROJECT: Record<string, string[]> = {
  PLAT: ["OAuth2 Implementation", "Rate Limiting", "API Gateway", "SDK Development"],
  DATA: ["ETL Optimization", "Real-time Streaming", "Data Quality", "Schema Evolution"],
  CUST: ["Portal Redesign", "Self-service Features", "Performance", "Accessibility"],
  MOB: ["iOS App", "Android App", "Push Notifications", "Offline Mode"],
  INT: ["Admin Dashboard", "HR Tools", "Finance Reports", "IT Automation"],
  INFRA: ["Kubernetes Migration", "Cost Optimization", "DR Planning", "Monitoring"],
  ANLYT: ["Executive Dashboard", "Custom Reports", "Data Export", "Alerting"],
  AUTH: ["SSO Integration", "MFA", "Session Management", "Audit Logging"],
  NOTIF: ["Email Templates", "SMS Delivery", "In-app Notifications", "Webhooks"],
  SRCH: ["Full-text Search", "Faceted Filtering", "Ranking", "Indexing"],
  PAY: ["Stripe Integration", "Invoicing", "Refunds", "Reconciliation"],
  DEVOPS: ["Pipeline Automation", "Container Registry", "Secrets Management", "SLO Tracking"],
};

const CATEGORIES = [
  { name: "Development", code: "DEV", color: "#6366f1" },
  { name: "Design", code: "DES", color: "#ec4899" },
  { name: "Meetings", code: "MTG", color: "#f59e0b" },
  { name: "Admin", code: "ADM", color: "#64748b" },
  { name: "Research", code: "RES", color: "#10b981" },
  { name: "Management", code: "MGT", color: "#8b5cf6" },
];

// ─── Users (Org Hierarchy) ────────────────────────────────────────────────────
// CEO → 3 VPs → 9 Directors → 18 ICs = 31 users total

const USERS = [
  // CEO
  { name: "Patricia Chen", email: "patricia.chen@company.com", title: "Chief Executive Officer", dept: "Leadership", role: Role.ADMIN },

  // VPs
  { name: "Marcus Williams", email: "marcus.williams@company.com", title: "VP Engineering", dept: "Engineering", role: Role.MANAGER },
  { name: "Sarah Johnson", email: "sarah.johnson@company.com", title: "VP Product", dept: "Product", role: Role.MANAGER },
  { name: "David Kim", email: "david.kim@company.com", title: "VP Operations", dept: "Operations", role: Role.MANAGER },

  // Directors under Marcus (Engineering)
  { name: "Alex Rivera", email: "alex.rivera@company.com", title: "Director of Platform", dept: "Engineering", role: Role.MANAGER },
  { name: "Jessica Park", email: "jessica.park@company.com", title: "Director of Data Engineering", dept: "Engineering", role: Role.MANAGER },
  { name: "Michael Torres", email: "michael.torres@company.com", title: "Director of Mobile", dept: "Engineering", role: Role.MANAGER },

  // Directors under Sarah (Product)
  { name: "Emily Watson", email: "emily.watson@company.com", title: "Director of Product - Core", dept: "Product", role: Role.MANAGER },
  { name: "Ryan Patel", email: "ryan.patel@company.com", title: "Director of Design", dept: "Design", role: Role.MANAGER },

  // Directors under David (Operations)
  { name: "Lisa Chang", email: "lisa.chang@company.com", title: "Director of Analytics", dept: "Data & Analytics", role: Role.MANAGER },
  { name: "James Mitchell", email: "james.mitchell@company.com", title: "Director of DevOps", dept: "Operations", role: Role.MANAGER },
  { name: "Amanda Foster", email: "amanda.foster@company.com", title: "Director of IT", dept: "Operations", role: Role.MANAGER },

  // ICs under Alex Rivera (Platform)
  { name: "Noah Thompson", email: "noah.thompson@company.com", title: "Senior Software Engineer", dept: "Engineering", role: Role.USER },
  { name: "Olivia Martinez", email: "olivia.martinez@company.com", title: "Software Engineer", dept: "Engineering", role: Role.USER },

  // ICs under Jessica Park (Data)
  { name: "Ethan Brown", email: "ethan.brown@company.com", title: "Senior Data Engineer", dept: "Engineering", role: Role.USER },
  { name: "Sophia Davis", email: "sophia.davis@company.com", title: "Data Engineer", dept: "Engineering", role: Role.USER },
  { name: "Liam Wilson", email: "liam.wilson@company.com", title: "Analytics Engineer", dept: "Engineering", role: Role.USER },

  // ICs under Michael Torres (Mobile)
  { name: "Ava Anderson", email: "ava.anderson@company.com", title: "iOS Engineer", dept: "Engineering", role: Role.USER },
  { name: "William Taylor", email: "william.taylor@company.com", title: "Android Engineer", dept: "Engineering", role: Role.USER },

  // ICs under Emily Watson (Product)
  { name: "Isabella Jackson", email: "isabella.jackson@company.com", title: "Senior Product Manager", dept: "Product", role: Role.USER },
  { name: "Mason White", email: "mason.white@company.com", title: "Product Manager", dept: "Product", role: Role.USER },

  // ICs under Ryan Patel (Design)
  { name: "Charlotte Harris", email: "charlotte.harris@company.com", title: "Senior UX Designer", dept: "Design", role: Role.USER },
  { name: "Elijah Martin", email: "elijah.martin@company.com", title: "UI Designer", dept: "Design", role: Role.USER },

  // ICs under Lisa Chang (Analytics)
  { name: "Mia Garcia", email: "mia.garcia@company.com", title: "Senior Data Analyst", dept: "Data & Analytics", role: Role.USER },
  { name: "Lucas Rodriguez", email: "lucas.rodriguez@company.com", title: "Data Analyst", dept: "Data & Analytics", role: Role.USER },

  // ICs under James Mitchell (DevOps)
  { name: "Harper Lee", email: "harper.lee@company.com", title: "Senior DevOps Engineer", dept: "Operations", role: Role.USER },
  { name: "Benjamin Walker", email: "benjamin.walker@company.com", title: "DevOps Engineer", dept: "Operations", role: Role.USER },

  // ICs under Amanda Foster (IT)
  { name: "Evelyn Hall", email: "evelyn.hall@company.com", title: "IT Systems Engineer", dept: "Operations", role: Role.USER },
  { name: "Alexander Young", email: "alexander.young@company.com", title: "IT Support Engineer", dept: "Operations", role: Role.USER },

  // Extra IC
  { name: "Abigail King", email: "abigail.king@company.com", title: "Full Stack Engineer", dept: "Engineering", role: Role.USER },
];

// ─── Main Seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding TIRP database...\n");

  // Clean in order
  await prisma.auditLog.deleteMany();
  await prisma.approvalEvent.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.personalAccessToken.deleteMany();
  await prisma.savedReport.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.syncJob.deleteMany();
  await prisma.initiative.deleteMany();
  await prisma.project.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.costCenter.deleteMany();
  console.log("✓ Cleared existing data");

  // ── Cost Centers ──────────────────────────────────────────────────────────
  const costCenters = await Promise.all(
    COST_CENTERS.map((cc) =>
      prisma.costCenter.create({ data: cc })
    )
  );
  const ccMap = Object.fromEntries(costCenters.map((cc) => [cc.code, cc]));
  console.log(`✓ Created ${costCenters.length} cost centers`);

  // ── Categories ────────────────────────────────────────────────────────────
  const categories = await Promise.all(
    CATEGORIES.map((cat) => prisma.category.create({ data: cat }))
  );
  const catMap = Object.fromEntries(categories.map((c) => [c.code, c]));
  console.log(`✓ Created ${categories.length} categories`);

  // ── Projects ──────────────────────────────────────────────────────────────
  const projects = await Promise.all(
    PROJECTS.map((p) => prisma.project.create({ data: p }))
  );
  const projectMap = Object.fromEntries(projects.map((p) => [p.code, p]));
  console.log(`✓ Created ${projects.length} projects`);

  // ── Initiatives ───────────────────────────────────────────────────────────
  const initiativesByProject: Record<string, { id: string; name: string }[]> = {};
  for (const project of projects) {
    const names = INITIATIVES_BY_PROJECT[project.code] ?? [];
    const created = await Promise.all(
      names.map((name) =>
        prisma.initiative.create({ data: { name, projectId: project.id, isActive: true } })
      )
    );
    initiativesByProject[project.id] = created;
  }
  console.log(`✓ Created initiatives`);

  // ── Users (with hierarchy) ────────────────────────────────────────────────
  const deptToCostCenter: Record<string, string> = {
    Engineering: "ENG",
    Leadership: "ENG",
    Product: "PROD",
    Design: "DSN",
    Operations: "OPS",
    "Data & Analytics": "DATA",
  };

  // First pass: create without manager
  const createdUsers: Array<{ id: string; name: string; email: string; role: Role }> = [];
  for (const u of USERS) {
    const cc = ccMap[deptToCostCenter[u.dept] ?? "ENG"];
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash: hashPassword("password123"),
        title: u.title,
        department: u.dept,
        role: u.role,
        costCenterId: cc?.id,
        weeklyTarget: u.role === Role.MANAGER || u.role === Role.ADMIN ? 40 : 40,
        isActive: true,
      },
    });
    createdUsers.push({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  // Build name → id map
  const userByName = Object.fromEntries(createdUsers.map((u) => [u.name, u]));
  const userByEmail = Object.fromEntries(createdUsers.map((u) => [u.email, u]));

  // Second pass: set manager relationships
  const managerRelations: Array<{ email: string; managerEmail: string }> = [
    // VPs → CEO
    { email: "marcus.williams@company.com", managerEmail: "patricia.chen@company.com" },
    { email: "sarah.johnson@company.com", managerEmail: "patricia.chen@company.com" },
    { email: "david.kim@company.com", managerEmail: "patricia.chen@company.com" },
    // Directors → VP Engineering
    { email: "alex.rivera@company.com", managerEmail: "marcus.williams@company.com" },
    { email: "jessica.park@company.com", managerEmail: "marcus.williams@company.com" },
    { email: "michael.torres@company.com", managerEmail: "marcus.williams@company.com" },
    // Directors → VP Product
    { email: "emily.watson@company.com", managerEmail: "sarah.johnson@company.com" },
    { email: "ryan.patel@company.com", managerEmail: "sarah.johnson@company.com" },
    // Directors → VP Operations
    { email: "lisa.chang@company.com", managerEmail: "david.kim@company.com" },
    { email: "james.mitchell@company.com", managerEmail: "david.kim@company.com" },
    { email: "amanda.foster@company.com", managerEmail: "david.kim@company.com" },
    // ICs → Alex Rivera
    { email: "noah.thompson@company.com", managerEmail: "alex.rivera@company.com" },
    { email: "olivia.martinez@company.com", managerEmail: "alex.rivera@company.com" },
    { email: "abigail.king@company.com", managerEmail: "alex.rivera@company.com" },
    // ICs → Jessica Park
    { email: "ethan.brown@company.com", managerEmail: "jessica.park@company.com" },
    { email: "sophia.davis@company.com", managerEmail: "jessica.park@company.com" },
    { email: "liam.wilson@company.com", managerEmail: "jessica.park@company.com" },
    // ICs → Michael Torres
    { email: "ava.anderson@company.com", managerEmail: "michael.torres@company.com" },
    { email: "william.taylor@company.com", managerEmail: "michael.torres@company.com" },
    // ICs → Emily Watson
    { email: "isabella.jackson@company.com", managerEmail: "emily.watson@company.com" },
    { email: "mason.white@company.com", managerEmail: "emily.watson@company.com" },
    // ICs → Ryan Patel
    { email: "charlotte.harris@company.com", managerEmail: "ryan.patel@company.com" },
    { email: "elijah.martin@company.com", managerEmail: "ryan.patel@company.com" },
    // ICs → Lisa Chang
    { email: "mia.garcia@company.com", managerEmail: "lisa.chang@company.com" },
    { email: "lucas.rodriguez@company.com", managerEmail: "lisa.chang@company.com" },
    // ICs → James Mitchell
    { email: "harper.lee@company.com", managerEmail: "james.mitchell@company.com" },
    { email: "benjamin.walker@company.com", managerEmail: "james.mitchell@company.com" },
    // ICs → Amanda Foster
    { email: "evelyn.hall@company.com", managerEmail: "amanda.foster@company.com" },
    { email: "alexander.young@company.com", managerEmail: "amanda.foster@company.com" },
  ];

  for (const rel of managerRelations) {
    const employee = userByEmail[rel.email];
    const manager = userByEmail[rel.managerEmail];
    if (employee && manager) {
      await prisma.user.update({
        where: { id: employee.id },
        data: { managerId: manager.id },
      });
    }
  }
  console.log(`✓ Created ${createdUsers.length} users with org hierarchy`);

  // ── PATs for test users ───────────────────────────────────────────────────
  const noahId = userByEmail["noah.thompson@company.com"]?.id;
  const ethanId = userByEmail["ethan.brown@company.com"]?.id;
  const adminId = userByEmail["patricia.chen@company.com"]?.id;

  const testPats = [
    {
      userId: noahId!,
      name: "CI/CD Bot",
      scopes: ["time:read", "time:write", "timesheet:submit"],
      rawToken: "tirp_ci_cd_bot_token_noah_test_00000001",
    },
    {
      userId: noahId!,
      name: "VS Code Extension",
      scopes: ["time:read", "time:write"],
      rawToken: "tirp_vscode_ext_token_noah_test_000002",
    },
    {
      userId: ethanId!,
      name: "Data Pipeline Agent",
      scopes: ["time:read", "time:write", "report:read"],
      rawToken: "tirp_data_pipeline_agent_ethan_test_03",
    },
    {
      userId: adminId!,
      name: "Power BI Connector",
      scopes: ["data:read", "report:read"],
      rawToken: "tirp_powerbi_connector_admin_test_00004",
    },
    {
      userId: adminId!,
      name: "Admin Automation",
      scopes: ["admin:read", "admin:write", "user:read", "user:write"],
      rawToken: "tirp_admin_automation_token_test_000005",
    },
  ];

  for (const pat of testPats) {
    if (!pat.userId) continue;
    const tokenHash = createHash("sha256").update(pat.rawToken).digest("hex");
    const tokenPrefix = pat.rawToken.replace("tirp_", "").substring(0, 8);
    await prisma.personalAccessToken.create({
      data: {
        userId: pat.userId,
        name: pat.name,
        tokenHash,
        tokenPrefix,
        scopes: pat.scopes,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });
  }
  console.log(`✓ Created ${testPats.length} PATs`);
  console.log(`  Note: Test PAT tokens are in seed.ts for reference only`);

  // ── Time Entries + Timesheets (6 months) ──────────────────────────────────
  const today = new Date();
  const sixMonthsAgo = subMonths(today, 6);
  const weekMonday = getWeekMonday(today);

  // All IC users + managers get time entries
  const timeTrackingUsers = createdUsers.filter(
    (u) => u.role === Role.USER || u.role === Role.MANAGER
  );

  // Project assignments per user (each user works on 2-3 projects)
  const userProjectAssignments: Record<string, string[]> = {};
  for (const user of timeTrackingUsers) {
    const count = Math.floor(randomBetween(2, 4));
    const shuffled = [...projects].sort(() => Math.random() - 0.5);
    userProjectAssignments[user.id] = shuffled.slice(0, count).map((p) => p.id);
  }

  let totalEntries = 0;
  let totalTimesheets = 0;

  // Get all Mondays in the 6-month window
  const weeks = eachWeekOfInterval(
    { start: sixMonthsAgo, end: today },
    { weekStartsOn: 1 }
  );

  for (const user of timeTrackingUsers) {
    const userProjects = userProjectAssignments[user.id];

    for (const weekStart of weeks) {
      const isCurrentWeek = weekStart.getTime() === weekMonday.getTime();
      const isPastWeek = weekStart < weekMonday;

      // Determine timesheet status
      let tsStatus: EntryStatus;
      if (isCurrentWeek) {
        tsStatus = EntryStatus.DRAFT;
      } else if (isPastWeek) {
        const r = Math.random();
        if (r < 0.7) tsStatus = EntryStatus.APPROVED;
        else if (r < 0.85) tsStatus = EntryStatus.SUBMITTED;
        else tsStatus = EntryStatus.DRAFT;
      } else {
        continue; // future week
      }

      // Create timesheet
      const submittedAt =
        tsStatus === EntryStatus.SUBMITTED || tsStatus === EntryStatus.APPROVED
          ? addDays(weekStart, 5 + Math.floor(randomBetween(0, 2)))
          : null;
      const approvedAt =
        tsStatus === EntryStatus.APPROVED
          ? submittedAt
            ? addDays(submittedAt, Math.floor(randomBetween(1, 3)))
            : null
          : null;

      // Find a manager to be the approver
      const managerId = createdUsers.find((u) => u.email === "marcus.williams@company.com")?.id;

      const timesheet = await prisma.timesheet.create({
        data: {
          userId: user.id,
          weekStart,
          status: tsStatus,
          submittedAt,
          approvedAt,
          approvedById: tsStatus === EntryStatus.APPROVED ? managerId : null,
        },
      });
      totalTimesheets++;

      // Create entries for Mon–Fri
      for (let d = 0; d < 5; d++) {
        const entryDate = addDays(weekStart, d);

        // Pick 1-2 projects per day
        const dayProjectCount = Math.random() < 0.3 ? 2 : 1;
        const dayProjects = [...userProjects]
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(dayProjectCount, userProjects.length));

        let remainingHours = parseFloat(randomBetween(6, 9).toFixed(1));

        for (let pi = 0; pi < dayProjects.length; pi++) {
          const projectId = dayProjects[pi];
          const projectInitiatives = initiativesByProject[projectId] ?? [];
          const initiative = projectInitiatives.length > 0 ? pickRandom(projectInitiatives) : null;

          // Pick category based on user role
          let cat: { id: string };
          if (user.role === Role.MANAGER) {
            cat = pickRandom([catMap.MTG, catMap.MGT, catMap.ADM]);
          } else {
            cat = pickRandom([catMap.DEV, catMap.DEV, catMap.DEV, catMap.RES, catMap.MTG]);
          }

          const isLastProject = pi === dayProjects.length - 1;
          const hours = isLastProject
            ? Math.max(1, parseFloat(remainingHours.toFixed(1)))
            : parseFloat((remainingHours / 2).toFixed(1));

          remainingHours -= hours;

          await prisma.timeEntry.create({
            data: {
              userId: user.id,
              date: entryDate,
              hours,
              projectId,
              initiativeId: initiative?.id ?? null,
              categoryId: cat.id,
              status: tsStatus,
              source: Math.random() < 0.05 ? EntrySource.AGENT : EntrySource.MANUAL,
              timesheetId: timesheet.id,
              notes:
                Math.random() < 0.3
                  ? pickRandom([
                      "Completed feature implementation",
                      "Code review and feedback",
                      "Sprint planning",
                      "Bug fixes and testing",
                      "Documentation updates",
                      "Performance optimization",
                      "Design review meeting",
                      "Stakeholder sync",
                    ])
                  : null,
            },
          });
          totalEntries++;
        }
      }

      // Create approval events for submitted/approved timesheets
      if (tsStatus === EntryStatus.SUBMITTED || tsStatus === EntryStatus.APPROVED) {
        await prisma.approvalEvent.create({
          data: {
            timesheetId: timesheet.id,
            actorId: user.id,
            action: "SUBMITTED",
            createdAt: submittedAt ?? weekStart,
          },
        });
      }
      if (tsStatus === EntryStatus.APPROVED && managerId) {
        await prisma.approvalEvent.create({
          data: {
            timesheetId: timesheet.id,
            actorId: managerId,
            action: "APPROVED",
            createdAt: approvedAt ?? addDays(weekStart, 7),
          },
        });
      }
    }
  }

  console.log(`✓ Created ${totalTimesheets} timesheets with ${totalEntries} time entries`);

  // ── Saved Reports ─────────────────────────────────────────────────────────
  const lisaId = userByEmail["lisa.chang@company.com"]?.id;
  if (lisaId) {
    await prisma.savedReport.createMany({
      data: [
        {
          userId: lisaId,
          name: "Weekly Engineering Hours",
          isShared: true,
          config: {
            type: "summary",
            groupBy: ["project"],
            dateRange: "last_4_weeks",
            filters: { department: "Engineering" },
          },
        },
        {
          userId: lisaId,
          name: "Monthly Utilization by Team",
          isShared: true,
          config: {
            type: "utilization",
            groupBy: ["manager", "week"],
            dateRange: "last_3_months",
          },
        },
        {
          userId: lisaId,
          name: "Project Breakdown - PLAT",
          isShared: false,
          config: {
            type: "time-series",
            projectCodes: ["PLAT"],
            groupBy: ["category"],
            dateRange: "last_6_months",
          },
        },
      ],
    });
  }
  console.log("✓ Created saved reports");

  // ── Import Jobs ───────────────────────────────────────────────────────────
  await prisma.importJob.createMany({
    data: [
      {
        type: "TIME_ENTRIES",
        filename: "replicon_export_2024_Q3.csv",
        status: JobStatus.COMPLETED,
        totalRows: 4823,
        processedRows: 4823,
        successRows: 4801,
        errorRows: 22,
        errors: [
          { row: 147, message: "Unknown project code: OLD_PROJ" },
          { row: 892, message: "Invalid date format" },
        ],
        createdAt: subMonths(today, 4),
        startedAt: subMonths(today, 4),
        completedAt: subMonths(today, 4),
      },
      {
        type: "USERS",
        filename: "replicon_users_migration.csv",
        status: JobStatus.COMPLETED,
        totalRows: 31,
        processedRows: 31,
        successRows: 31,
        errorRows: 0,
        createdAt: subMonths(today, 4),
        startedAt: subMonths(today, 4),
        completedAt: subMonths(today, 4),
      },
      {
        type: "PROJECTS",
        filename: "replicon_projects.csv",
        status: JobStatus.COMPLETED,
        totalRows: 12,
        processedRows: 12,
        successRows: 12,
        errorRows: 0,
        createdAt: subMonths(today, 4),
        startedAt: subMonths(today, 4),
        completedAt: subMonths(today, 4),
      },
    ],
  });
  console.log("✓ Created import jobs");

  // ── Sync Jobs ─────────────────────────────────────────────────────────────
  await prisma.syncJob.createMany({
    data: [
      {
        type: "WORKDAY_USERS",
        status: JobStatus.COMPLETED,
        triggeredBy: "scheduled",
        result: { created: 0, updated: 2, deactivated: 0, errors: [] },
        createdAt: subMonths(today, 1),
        startedAt: subMonths(today, 1),
        completedAt: subMonths(today, 1),
      },
      {
        type: "WORKDAY_ORG",
        status: JobStatus.COMPLETED,
        triggeredBy: "scheduled",
        result: { synced: 31, errors: [] },
        createdAt: subMonths(today, 1),
        startedAt: subMonths(today, 1),
        completedAt: subMonths(today, 1),
      },
      {
        type: "WORKDAY_USERS",
        status: JobStatus.COMPLETED,
        triggeredBy: "scheduled",
        result: { created: 1, updated: 0, deactivated: 0, errors: [] },
        createdAt: subMonths(today, 2),
        startedAt: subMonths(today, 2),
        completedAt: subMonths(today, 2),
      },
    ],
  });
  console.log("✓ Created sync jobs");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n✅ Seed complete!");
  console.log(`\n📊 Summary:`);
  console.log(`   Users: ${createdUsers.length}`);
  console.log(`   Projects: ${projects.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Timesheets: ${totalTimesheets}`);
  console.log(`   Time entries: ${totalEntries}`);
  console.log(`\n🔑 Test credentials:`);
  console.log(`   Admin:   patricia.chen@company.com / password123`);
  console.log(`   Manager: marcus.williams@company.com / password123`);
  console.log(`   User:    noah.thompson@company.com / password123`);
  console.log(`\n🔐 Test PAT tokens (stored hashed — these are for dev reference):`);
  console.log(`   CI/CD Bot:          tirp_ci_cd_bot_token_noah_test_00000001`);
  console.log(`   Power BI Connector: tirp_powerbi_connector_admin_test_00004`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
