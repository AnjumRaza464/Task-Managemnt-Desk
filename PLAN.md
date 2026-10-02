# Monthly Task Management App — Plan (Approval ke liye)

> Yeh document project ka poora naqsha hai. Approve hone ke baad isi tarteeb se implement hoga.

---

## 0. Existing project inspection (jo mila)

| Item | Status |
|---|---|
| `E:\taskmanagement` folder | Khali tha, sirf `.env.txt` (Neon `DB_URL`) tha |
| Neon DB `taskapp` | Connect ho gaya, PostgreSQL 18.6, abhi **0 tables** |
| Neon skills | `neon` + `neon-postgres` install ho gaye (`.claude/skills/`) |
| Node / npm | v24.21.0 / 11.19.0 |
| `E:\Testing material\sale1` | Alag Python (Streamlit) project hai, is app se koi taluq nahi |

**Note:** Aapka `DB_URL` pooled hai (`-pooler` hostname). Prisma migrations ke liye **direct URL** chahiye (bas `-pooler` hata dena hota hai). Dono `.env` mein rakhenge: `DATABASE_URL` (pooled, app ke liye) aur `DIRECT_URL` (migrations ke liye).

---

## 1. Architecture

```
Browser (React 19, shadcn/ui, Tailwind v4, Recharts)
        |
        v
Next.js 16 App Router (TypeScript)
  |- proxy.ts (route guard: bina login /login pe bhej do)
  |- Server Components  -> data padhna (Prisma se seedha)
  |- Server Actions     -> create / update / delete (Zod validate + requireManager())
  |- Route Handlers     -> /api/auth (Auth.js), /api/export (CSV/XLSX), /api/attachments/[id] (download)
        |
        v
Prisma 7 (@prisma/adapter-pg)  ->  Neon PostgreSQL (taskapp)
```

**Key decisions (simple rakhne ke liye):**

| Cheez | Faisla | Kyun |
|---|---|---|
| Auth | Auth.js v5 (`next-auth@beta`), Credentials provider, JWT session, bcrypt password | Sirf Admin/Manager login; koi OAuth nahi chahiye |
| Authorization | Har page + har server action mein `requireManager()` (server-side) + `proxy.ts` route guard | Double protection, spec ki demand |
| Users | Ek hi `User` table, `role` = ADMIN / MANAGER / MEMBER. Sirf ADMIN/MANAGER ke paas password hota hai aur login kar sakte hain. MEMBER sirf assignee hai (login nahi) | Spec: "NO separate user login" |
| Data fetching | Server Components + URL searchParams (filters/sort/search) | Client state kam, refresh friendly, koi heavy table library nahi |
| Mutations | Server Actions + Zod schemas (`lib/validations/`) | Type-safe, ek hi jagah validation |
| Overdue | `OVERDUE` status enum mein hai; helper `syncOverdueTasks()` PENDING/IN_PROGRESS tasks jinki dueDate guzar gayi unko OVERDUE mark karta hai (dashboard/tasks load par chalta hai) | Cron ki zaroorat nahi |
| Attachments | File bytes Postgres mein (`bytea`, max 5 MB/file) + metadata. Download route handler se | Vercel/serverless par bhi chalega, koi extra storage service nahi. (Chaho to baad mein Neon Object Storage/Vercel Blob laga sakte hain) |
| Notifications | Manager ke liye in-app notifications: task completed, overdue, due today, comment added. Server actions mein generate hoti hain | Email/push nahi (over-engineering) |
| Kanban DnD | Native HTML5 drag & drop + server action | Extra library nahi |
| Calendar | Custom month grid (date-fns) | Extra library nahi |
| Export | CSV (built-in) + XLSX (`exceljs`) | Spec: CSV/Excel |
| Theme | `next-themes` + shadcn dark/light | Standard |

---

## 2. Tech stack (pinned versions)

| Package | Version |
|---|---|
| next | 16.3.x |
| react / react-dom | 19.3.x |
| typescript | 5.x |
| tailwindcss | 4.x |
| shadcn/ui (CLI 4.x) + lucide-react | latest |
| prisma / @prisma/client / @prisma/adapter-pg | **7.10.0** (stable; 8 abhi RC hai) |
| next-auth | 5.0.0-beta (Auth.js v5) |
| zod | 4.x |
| recharts | 3.x |
| date-fns | 4.x |
| bcryptjs | 3.x |
| exceljs | 4.4 |
| next-themes, sonner (toasts) | latest |

---

## 3. Folder structure

```
taskmanagement/
|- prisma/
|  |- schema.prisma
|  |- migrations/
|  |- seed.ts                 # admin account + default categories
|- prisma.config.ts           # Prisma 7 config (DIRECT_URL migrations ke liye)
|- proxy.ts                   # route protection (Next 16 mein middleware ka naya naam)
|- auth.ts                    # Auth.js config (credentials, callbacks)
|- src/
|  |- app/
|  |  |- (auth)/login/page.tsx
|  |  |- (app)/                          # protected shell (sidebar + header)
|  |  |  |- layout.tsx
|  |  |  |- dashboard/page.tsx
|  |  |  |- users/page.tsx
|  |  |  |- users/[id]/page.tsx          # user details + uske tasks
|  |  |  |- monthly-plans/page.tsx       # Month -> User -> Tasks
|  |  |  |- monthly-plans/[id]/page.tsx  # ek plan ka view
|  |  |  |- tasks/page.tsx               # All tasks table (search/filter/sort)
|  |  |  |- tasks/kanban/page.tsx
|  |  |  |- tasks/[id]/page.tsx          # task details (subtasks, comments, attachments, activity)
|  |  |  |- calendar/page.tsx
|  |  |  |- reports/page.tsx
|  |  |  |- notifications/page.tsx
|  |  |  |- settings/page.tsx            # profile, password, categories
|  |  |- api/
|  |  |  |- auth/[...nextauth]/route.ts
|  |  |  |- export/route.ts              # ?report=monthly|users|status|priority&format=csv|xlsx
|  |  |  |- attachments/[id]/route.ts    # download
|  |  |- layout.tsx, globals.css, error.tsx, not-found.tsx
|  |- components/
|  |  |- ui/                  # shadcn components
|  |  |- layout/              # sidebar, header, theme-toggle, mobile-nav
|  |  |- dashboard/           # stat-cards, charts (recharts)
|  |  |- users/               # user-table, user-form-dialog
|  |  |- plans/               # month-picker, plan-board
|  |  |- tasks/               # task-table, task-filters, task-form-dialog, kanban-board,
|  |  |                       # subtask-list, comments, attachments, status-badge, priority-badge
|  |  |- calendar/            # month-grid
|  |  |- reports/             # report-tables, export-buttons
|  |  |- shared/              # empty-state, loading-skeleton, confirm-dialog, pagination
|  |- actions/                # server actions (ek file per module)
|  |  |- users.ts, plans.ts, tasks.ts, subtasks.ts, comments.ts,
|  |  |- attachments.ts, categories.ts, notifications.ts, settings.ts
|  |- lib/
|  |  |- prisma.ts            # PrismaClient singleton (pg adapter)
|  |  |- auth-guard.ts        # requireManager(), getSession()
|  |  |- validations/         # Zod schemas (user, task, plan, ...)
|  |  |- queries/             # read queries: dashboard.ts, tasks.ts, reports.ts, ...
|  |  |- activity.ts          # logActivity(), notify()
|  |  |- overdue.ts           # syncOverdueTasks()
|  |  |- export.ts            # CSV/XLSX builders
|  |  |- utils.ts, constants.ts (status/priority labels & colors)
|  |- types/                  # shared TS types, next-auth.d.ts
|- .env  (DATABASE_URL, DIRECT_URL, AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD)
|- .env.example
|- package.json
```

---

## 4. Prisma schema

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")   // pooled - app
  // directUrl prisma.config.ts mein (DIRECT_URL) - migrations
}

enum Role        { ADMIN MANAGER MEMBER }
enum TaskStatus  { PENDING IN_PROGRESS COMPLETED OVERDUE CANCELLED }
enum Priority    { LOW MEDIUM HIGH CRITICAL }
enum NotificationType { TASK_ASSIGNED TASK_COMPLETED TASK_OVERDUE TASK_DUE_TODAY COMMENT_ADDED SYSTEM }

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String?              // sirf ADMIN/MANAGER ke liye
  role         Role     @default(MEMBER)
  designation  String?
  department   String?
  phone        String?
  avatarUrl    String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  plans          MonthlyPlan[]
  assignedTasks  Task[]        @relation("TaskAssignee")
  createdTasks   Task[]        @relation("TaskCreator")
  comments       Comment[]
  attachments    Attachment[]
  activityLogs   ActivityLog[]
  notifications  Notification[]

  @@index([role, isActive])
}

model MonthlyPlan {
  id        String   @id @default(cuid())
  userId    String
  year      Int
  month     Int                      // 1-12
  title     String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks Task[]

  @@unique([userId, year, month])
  @@index([year, month])
}

model Category {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String   @default("#6366f1")
  createdAt DateTime @default(now())
  tasks     Task[]
}

model Task {
  id            String     @id @default(cuid())
  title         String
  description   String?
  planId        String
  assigneeId    String
  createdById   String
  categoryId    String?
  priority      Priority   @default(MEDIUM)
  status        TaskStatus @default(PENDING)
  completion    Int        @default(0)        // 0-100
  startDate     DateTime?
  dueDate       DateTime
  completedAt   DateTime?
  position      Int        @default(0)        // kanban ordering
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  plan          MonthlyPlan  @relation(fields: [planId], references: [id], onDelete: Cascade)
  assignee      User         @relation("TaskAssignee", fields: [assigneeId], references: [id])
  createdBy     User         @relation("TaskCreator",  fields: [createdById], references: [id])
  category      Category?    @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  subtasks      SubTask[]
  comments      Comment[]
  attachments   Attachment[]
  activity      ActivityLog[]
  notifications Notification[]

  @@index([assigneeId, status])
  @@index([planId])
  @@index([dueDate])
  @@index([status, priority])
}

model SubTask {
  id          String   @id @default(cuid())
  taskId      String
  title       String
  isCompleted Boolean  @default(false)
  position    Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  @@index([taskId])
}

model Comment {
  id        String   @id @default(cuid())
  taskId    String
  authorId  String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author User @relation(fields: [authorId], references: [id])
  @@index([taskId])
}

model Attachment {
  id           String   @id @default(cuid())
  taskId       String
  uploadedById String
  fileName     String
  mimeType     String
  size         Int
  data         Bytes                       // file content (<= 5 MB)
  createdAt    DateTime @default(now())
  task       Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  uploadedBy User @relation(fields: [uploadedById], references: [id])
  @@index([taskId])
}

model ActivityLog {
  id        String   @id @default(cuid())
  actorId   String
  taskId    String?
  action    String                          // e.g. TASK_CREATED, STATUS_CHANGED, USER_DEACTIVATED
  entity    String                          // Task | User | MonthlyPlan | ...
  entityId  String
  details   Json?                           // { from, to, field, ... }
  createdAt DateTime @default(now())
  actor User  @relation(fields: [actorId], references: [id])
  task  Task? @relation(fields: [taskId], references: [id], onDelete: Cascade)
  @@index([taskId])
  @@index([createdAt])
}

model Notification {
  id        String           @id @default(cuid())
  userId    String                           // recipient (manager/admin)
  taskId    String?
  type      NotificationType
  title     String
  message   String
  isRead    Boolean          @default(false)
  dedupeKey String?          @unique          // e.g. "OVERDUE:<taskId>:2026-09-30" (duplicate rokne ke liye)
  createdAt DateTime         @default(now())
  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  task Task? @relation(fields: [taskId], references: [id], onDelete: Cascade)
  @@index([userId, isRead])
}
```

**Relationship summary:** User 1->N MonthlyPlan 1->N Task 1->N (SubTask, Comment, Attachment, ActivityLog, Notification). Task N->1 Category. Task ka `assigneeId` hamesha uske plan ke `userId` ke barabar rahega (reassign par task doosre user ke usi month ke plan mein move hota hai; plan na ho to ban jata hai).

---

## 5. Pages & features map

| Route | Kya hoga |
|---|---|
| `/login` | Email + password form, error state, sirf ADMIN/MANAGER + isActive |
| `/dashboard` | 9 stat cards (users, tasks, completed, pending, in-progress, overdue, completion %, due today, due this week) + 4 charts (monthly progress line, user-wise bar, status pie, priority bar) + recent activity |
| `/users` | Table (search, role/status filter), Add/Edit dialog, Activate/Deactivate, Delete (confirm), View -> `/users/[id]` (details + task stats + task list) |
| `/monthly-plans` | Month picker -> users list with plan summary -> plan detail `/monthly-plans/[id]` (tasks of that user for that month, add task inline) |
| `/tasks` | All tasks table: search, filters (user, month, status, priority, category, due date range), sort, pagination; Add/Edit dialog |
| `/tasks/kanban` | 5 columns (status), drag & drop, same filters |
| `/tasks/[id]` | Task details: edit fields, completion slider, subtasks (add/toggle/edit/delete), comments, attachments (upload/download/delete), activity timeline |
| `/calendar` | Month grid, tasks on due date, click -> task; user/status filter |
| `/reports` | 4 reports (Monthly, User-wise performance, Status (Completed/Pending/Overdue), Priority-wise) with tables + charts + **Export CSV / XLSX** |
| `/notifications` | List, mark read / mark all read, unread badge sidebar mein |
| `/settings` | Profile (name/email), change password, Categories CRUD, theme |

---

## 6. Implementation plan (step-by-step)

| Step | Kaam | Output |
|---|---|---|
| 1 | Project scaffold: `create-next-app` (TS, Tailwind, App Router, src/), shadcn init + components, deps install, `.env`/`.env.example`, Prisma 7 setup, schema, **migrate on Neon**, seed (admin + categories) | Chalta hua khali app, DB tables bane hue |
| 2 | Auth: Auth.js v5 credentials, `auth.ts`, `proxy.ts`, `requireManager()`, `/login` page, logout, app shell (sidebar, header, theme toggle, toaster, loading/error/empty components) | Login -> dashboard shell |
| 3 | Users module: CRUD + activate/deactivate + details page + activity log | `/users` complete |
| 4 | Categories + Monthly plans + Tasks core: Zod schemas, server actions (task CRUD, reassign, status/completion, overdue sync), plan pages, tasks table with filters/sort/search | `/monthly-plans`, `/tasks` complete |
| 5 | Task details: subtasks, comments, attachments (upload/download), activity timeline, notifications generate | `/tasks/[id]` complete |
| 6 | Kanban + Calendar views | `/tasks/kanban`, `/calendar` |
| 7 | Dashboard: aggregate queries + Recharts charts | `/dashboard` |
| 8 | Reports + CSV/XLSX export, Notifications page, Settings page | `/reports`, `/notifications`, `/settings` |
| 9 | Testing: demo data script, auth/permission checks (logged-out, MEMBER, inactive), CRUD flows, dashboard numbers vs DB, filters, exports, mobile/dark mode (browser preview), `npm run build` + lint clean | Final verified app + README |

Har step ke baad main browser mein check karke aapko screenshot/proof dunga.

---

## 7. Aapse confirm karne wali cheezein

1. **Admin login credentials** seed ke liye: default email `admin@taskapp.local`, password `.env` mein `SEED_ADMIN_PASSWORD` (main ek strong random rakh dunga, aap badal sakte hain). Theek hai?
2. **Attachments Postgres mein** (max 5 MB) — theek hai, ya Neon Object Storage / Vercel Blob chahiye?
3. **Demo data**: testing ke liye kuch sample users/tasks Neon mein daalun (baad mein delete kar sakte hain)? Ya sirf admin + categories?
4. UI **English** mein rahegi (standard SaaS), chat Roman Urdu mein. Theek?
