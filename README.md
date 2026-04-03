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
