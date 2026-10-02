# AI Research Lab · Task Management

Monthly task planning and tracking for small teams. Managers create users, plan each person's month, assign tasks and follow progress through a dashboard, kanban board, calendar and reports. Team members can sign in to a read-only view of their own tasks.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Turbopack) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Base UI), lucide-react, Recharts |
| Database | PostgreSQL on Neon via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Auth.js v5 (credentials provider, JWT sessions, bcrypt) |
| Validation | Zod 4 |
| Export | CSV (built in) and Excel (`exceljs`) |

## Features

- **Dashboard**: stat cards, monthly progress, status and priority charts, team workload, due-soon list, recent activity.
- **Users**: CRUD, activate/deactivate, per-user task stats. Roles: `ADMIN`, `MANAGER` (full access) and `MEMBER` (assignee; may sign in to a read-only view).
- **Monthly plans**: one plan per user per month. Tasks land in the assignee's plan based on their due date; reassigning moves them.
- **Tasks**: searchable, filterable, sortable table; kanban with drag and drop; calendar by due date; task detail with subtasks, comments, attachments (stored in Postgres, 5 MB max) and an activity timeline.
- **Automatic status rules**: 100 % completion marks a task completed; past-due open tasks become overdue on page load; notifications are raised for assignments, completions, overdue and due-today tasks and comments.
- **Reports**: monthly, user performance, by status and by priority, scoped to a month or all time, each exportable to CSV or Excel.
- **Settings**: profile, password, task categories, light/dark theme.

## Getting started

### 1. Prerequisites

- Node.js 20 or newer
- A PostgreSQL database (the project is set up for [Neon](https://neon.tech))

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled connection string used by the app |
| `DIRECT_URL` | Direct (non-pooled) connection used by Prisma migrations |
| `AUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `AUTH_TRUST_HOST` | Set to `true` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | First admin account created by the seed |
| `SEED_MEMBER_PASSWORD` | Password given to demo members by the demo seed |

### 3. Install, migrate and seed

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

The base seed creates the admin account and eight default categories. To add three demo members with plans and tasks for September to November 2026:

```bash
npm run db:seed:demo
```

Both seeds are idempotent and can be re-run.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the seed admin credentials. Managers land on `/dashboard`; members land on `/my-tasks`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Admin account and default categories |
| `npm run db:seed:demo` | Demo members, plans and tasks |
| `npm run db:studio` | Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client (also runs on `postinstall`) |

## Project layout

```
prisma/              schema, migrations, seeds
src/
  app/
    (auth)/login     sign-in page
    (app)/           manager area: dashboard, users, monthly-plans, tasks,
                     tasks/kanban, tasks/[id], calendar, reports,
                     notifications, settings
    (member)/        read-only member area: my-tasks
    api/             auth, attachment download, report export
  actions/           server actions (one file per module, Zod validated)
  lib/
    queries/         read queries used by pages
    validations/     Zod schemas
    auth-guard.ts    requireManager / requireMemberPage helpers
    overdue.ts       marks past-due tasks overdue and raises notifications
    export.ts        CSV / XLSX builders
  components/        ui (shadcn), layout, and one folder per feature
  proxy.ts           route protection (Next.js 16 proxy, formerly middleware)
```

## Authorization model

- `src/proxy.ts` redirects guests to `/login`, keeps members inside `/my-tasks`, and keeps managers out of the member area.
- Every manager page calls `requireManagerPage()` and every server action calls `requireManager()`, which re-validate the user against the database so deactivation takes effect immediately.
- `ADMIN` and `MANAGER` currently have identical permissions.

## Deployment

Any Node.js host works (Vercel, a VPS, Docker). Set the environment variables above, run `npm run db:deploy` against the production database, then `npm run build` and `npm run start`. Attachments live in the database, so no file storage service is required.
