# TIRP — Time Intelligence & Reporting Platform

TIRP is an enterprise time tracking and timesheet management system built with Next.js 15. It supports weekly timesheet submission, multi-level approval workflows, project attribution, and analytics — with first-class API access for integrations and BI tooling.

## Features

- **Timesheet workflows** — weekly submission, approval, rejection, and recall
- **Time entry management** — manual entry and bulk import (CSV / Replicon)
- **Project attribution** — projects, initiatives, categories, and cost centers
- **Admin dashboard** — user, project, and import management
- **Workday sync** — HR data sync with mock and live adapters
- **Reporting & analytics** — time-series, utilization, saved reports, and SQL views for Power BI
- **Developer API** — Personal Access Tokens (PATs) with scoped access and audit logging
- **Background jobs** — async import and sync processing via BullMQ + Redis
- **Imports** — automatic time entry import from external sources (Jira Data Center; extensible for future sources)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 3, Radix UI, Lucide Icons |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Auth | NextAuth v5 |
| Validation | Zod |
| Charts | Recharts |

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local database and Redis)
- npm

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
DATABASE_URL="postgresql://tirp:tirp_password@localhost:5432/tirp"
AUTH_SECRET=""        # generate: openssl rand -base64 32
AUTH_URL="http://localhost:3000"
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="TIRP"
WORKDAY_ADAPTER="mock"
ENCRYPTION_KEY=""     # generate: openssl rand -hex 32
LOG_LEVEL="info"
```

### 3. Start services

```bash
docker compose up -d db redis
```

### 4. Set up the database

```bash
npm run db:full-setup   # migrate + seed + create views
```

### 5. Start the app

```bash
npm run dev             # web server on http://localhost:3000
npm run worker          # background job processor (separate terminal)
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run worker` | Start background job processor |
| `npm run db:full-setup` | Migrate, seed, and create SQL views |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database with test data |
| `npm run db:reset` | Reset database and re-seed |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:views` | Create PostgreSQL analytics views |

## Docker

The full stack can be run via Docker Compose:

```bash
docker compose up
```

This starts four services: `db` (PostgreSQL 16), `redis` (Redis 7), `app` (Next.js on port 3000), and `worker` (BullMQ processor).

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login page
│   ├── (dashboard)/      # Protected routes: timesheet, approvals, reports, admin
│   └── api/              # REST API route handlers
├── components/
│   ├── ui/               # Reusable Radix UI components
│   ├── timesheet/        # Timesheet-specific components
│   └── pats/             # PAT management components
├── jobs/                 # BullMQ workers and job definitions
├── lib/                  # Auth, Prisma client, validation, utilities
└── middleware.ts          # Auth and routing middleware
prisma/
├── schema.prisma          # Database schema
├── seed.ts                # Seed script
├── views.sql              # Analytics SQL views
└── migrations/            # Migration history
docker/
├── Dockerfile             # App container
└── Dockerfile.worker      # Worker container
```

## API Access

TIRP exposes a REST API secured with Personal Access Tokens. Tokens can be created from **Settings → API Tokens** in the dashboard. Each token has scoped permissions (e.g., `time:read`, `time:write`).

All API actions are recorded in an audit log.

## Workday Integration

Set `WORKDAY_ADAPTER=mock` (default) for development. Switch to `live` and configure `WORKDAY_TENANT_URL`, `WORKDAY_USERNAME`, and `WORKDAY_PASSWORD` for production HR sync.

## Imports

TIRP can automatically import time entries from external sources on an hourly schedule. Import sources are configured at two levels:

- **Admin (system-wide):** Admins configure the connection details and define project mappings that apply to all users. Navigate to **Integrations** in the admin nav.
- **User (per-account):** Each user provides their own credentials for the import source. Navigate to **Settings → Imports** in the dashboard.

### Jira Data Center

Imports worklogs from a self-hosted Jira Data Center instance (requires Jira DC 8.14+ for Personal Access Token support).

#### Admin setup

1. Navigate to **Integrations** in the admin navigation.
2. Enter the **Jira Data Center URL** (e.g. `https://jira.company.com`).
3. Use the **Test Connection** panel to verify connectivity with a PAT before saving.
4. Enable the integration and click **Save**.
5. Add **Project Mappings**: each mapping links a Jira project key (e.g. `PROJ`) to a specific task in TIRP. Worklogs on issues in unmapped projects are silently skipped.

#### User setup

1. Navigate to **Settings → Imports** in the dashboard.
2. Enter your **Jira username** (the login name Jira uses to attribute worklogs to you).
3. Generate a Personal Access Token in Jira: **Profile → Personal Access Tokens → Create token**.
4. Paste the token into the **Personal Access Token** field and click **Connect**.

The token is stored encrypted at rest (`AES-256-GCM`) and is never returned by the API after saving.

#### How the sync works

- A BullMQ job runs **every hour** (`0 * * * *`) via the worker process.
- For each user with an active Jira DC config, the job fetches all worklogs authored by that user during the **current week** (Monday–Sunday).
- Each worklog is matched to a TIRP task via the admin project mappings and creates or updates a `DRAFT` time entry.
- `SUBMITTED` and `APPROVED` entries are never modified by the sync.
- Idempotency is guaranteed via `externalId = "jira_dc_worklog_{id}"` — re-running the sync never creates duplicates.
- Sync results (entries created/updated/skipped, any per-user errors) are logged to the `jira_dc_sync_logs` table.

#### Architecture note

The Jira Data Center client lives in `src/lib/integrations/jira-dc/`. This directory is intentionally scoped to the DC variant — a future `jira-cloud/` adapter would live alongside it and use OAuth2 instead of Bearer PATs.
