# WorkHub brief vs. current app — gap analysis

Reviewed on 2026-10-30 against `main` (commit `5342776`). Status legend:
**Implemented** = works as the brief describes · **Partial** = exists in a weaker form ·
**Missing** = not in the codebase.

## 1. Overall system structure

| Brief feature | Status | Where it lives today |
|---|---|---|
| Multiple workspaces | Missing | — (only one implicit "company"; `MonthlyPlan` is the top-level container, `prisma/schema.prisma`) |
| Projects inside a workspace | Missing | — (closest: `MonthlyPlan` = one user × one month, `src/lib/queries/plans.ts`) |
| Lists / sections inside a project | Missing | — (status columns on the kanban are the only grouping, `src/components/tasks/kanban-board.tsx`) |
| Tasks under a list | Partial | Tasks hang off a `MonthlyPlan` by assignee + due month, `src/actions/tasks.ts` (`resolvePlan` in `src/lib/recurrence.ts`) |
| Hierarchy showing what / who / stage | Partial | Task table, kanban and plan pages show assignee + status, `src/components/tasks/task-table.tsx` |
| Move tasks between lists / stages | Partial | Drag between status columns only, `src/components/tasks/kanban-board.tsx`; no list-to-list move |

## 2. Task management

| Brief feature | Status | Where it lives today |
|---|---|---|
| Create tasks within projects | Partial | `createTask` in `src/actions/tasks.ts`; target is a monthly plan, not a project |
| Description / detailed instructions | Implemented | `Task.description`, `src/components/tasks/task-form-dialog.tsx` |
| Assign ONE task to MULTIPLE members | Missing | `Task.assigneeId` is a single FK; `reassignTask` replaces the person |
| Deadlines | Implemented | `Task.startDate` / `Task.dueDate`, overdue sync in `src/lib/overdue.ts` |
| Priorities | Implemented | `Priority` enum, `src/components/shared/badges.tsx` |
| Subtasks / checklists | Implemented | `SubTask` model, `src/actions/subtasks.ts`, `src/components/tasks/subtask-list.tsx` |
| Progress and completion status | Implemented | `Task.completion` + `TaskStatus`, `src/lib/task-progress.ts`, `src/components/tasks/task-progress-card.tsx` |
| Attachments / files / references | Implemented | `Attachment` model (5 MB, stored in DB), `src/actions/attachments.ts`, `src/app/api/attachments/[id]/route.ts` |
| Update tasks without duplicate entries | Partial | Edit in place works; but the single-assignee model forces a duplicate task per person |
| Repeating tasks (bonus) | Implemented | `src/lib/recurrence.ts` |

## 3. Discussions & communication

| Brief feature | Status | Where it lives today |
|---|---|---|
| Discussion section per task | Partial | Flat comments, manager-only posting, `src/actions/comments.ts`, `src/components/tasks/comment-section.tsx`; members can only read (`src/app/(member)/my-tasks/[id]/page.tsx`) |
| Discussion section per project | Missing | — (team channel in `src/components/chat/chat-widget.tsx` is global, not per project) |
| Replies / threads | Missing | `Comment` has no `parentId` |
| Mention / tag team members | Missing | — |
| Share updates / instructions / feedback with the task | Partial | Comments + attachments on the task; assignee cannot reply |
| Notifications for comments | Partial | Assignee + managers get `COMMENT_ADDED`, `src/actions/comments.ts`; no mention notifications |

## 4. Team & member management

| Brief feature | Status | Where it lives today |
|---|---|---|
| Individual accounts | Implemented | `User` model, credentials auth in `src/auth.ts`, `src/actions/users.ts` |
| Add members to specific projects | Missing | — (no project, therefore no project membership) |
| Multiple people per task | Missing | see §2 |
| Roles and responsibilities | Partial | Global `Role` ADMIN / MANAGER / MEMBER only, `src/lib/auth-guard.ts` |
| Permissions by role | Partial | Managers do everything, members only update status / progress of their own tasks (`src/actions/member.ts`); no per-project roles |
| Managers monitor team activity | Implemented | Dashboard activity feed `src/lib/queries/dashboard.ts`, per-task timeline `src/components/tasks/activity-timeline.tsx`, attendance `src/lib/attendance.ts`, reports `src/lib/queries/reports.ts` |

## 5. Project organization & workflow

| Brief feature | Status | Where it lives today |
|---|---|---|
| Workspace → Project → Lists → Tasks → Subtasks | Missing | Only Task → SubTask exists |
| Each project has own tasks, members, deadlines, discussions, progress | Missing | — |
| Move tasks between lists and stages | Partial | Stage (status) moves only |

## 6. Additional features

| Brief feature | Status | Where it lives today |
|---|---|---|
| Project timelines | Missing | — (no Gantt / timeline view) |
| Calendar view | Implemented | `src/app/(app)/calendar/page.tsx`, `src/components/calendar/month-grid.tsx` (managers only) |
| Task dependencies | Missing | — |
| Milestones | Missing | — |
| Progress tracking | Implemented | Completion %, plan / user / dashboard rollups, `src/lib/queries/plans.ts`, `src/lib/queries/dashboard.ts` |
| Team activity updates | Implemented | `ActivityLog`, `src/lib/activity.ts`, `src/lib/activity-format.ts` |
| Notifications and reminders | Implemented | In-app `Notification` (assigned, completed, overdue, due today, comment, file), `src/lib/activity.ts`, `src/lib/overdue.ts`, `src/components/notifications/notification-list.tsx`; email was removed on purpose |
| File and document management | Implemented | Task attachments + shared files, `src/actions/files.ts`, `src/app/(app)/files`, `src/app/(member)/my-files` |
| Project discussions | Missing | — |
| Workflow automation | Partial | Only built-in rules: overdue auto-status, 100 % ⇒ completed, repeating tasks spawn next occurrence |
| Role-based access and permissions | Partial | Global roles only (see §4) |
| Global search (bonus) | Implemented | `src/actions/search.ts`, `src/components/layout/global-search.tsx` |

## Summary

Already solid: tasks (description, dates, priority, subtasks, progress, attachments, recurrence), activity log,
in-app notifications, calendar, reports, attendance, files, chat, global search.

Missing and blocking the brief: the **Workspace → Project → List** hierarchy, **multiple assignees per task**,
**threaded comments with @mentions**, **project membership + per-project roles**, **milestones**, **dependencies**,
**project timeline** and **project-level discussions**.

Key design constraint: `MonthlyPlan` is unique per (user, year, month) and every task belongs to exactly one plan
of exactly one assignee. Multi-assignee tasks cannot be represented in that model, so the hierarchy decision
(replace vs. sit alongside) has to be made before the data model changes.
