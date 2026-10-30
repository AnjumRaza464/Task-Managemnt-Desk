import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use the format YYYY-MM-DD");

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6366f1").default("#6366f1");

export const PROJECT_ROLE = z.enum(["OWNER", "MANAGER", "MEMBER", "VIEWER"]);
export const PROJECT_STATUS = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]);

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  description: optionalText(500),
  color,
});

export const projectSchema = z
  .object({
    workspaceId: z.string().min(1, "Select a workspace"),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    description: optionalText(2000),
    color,
    status: PROJECT_STATUS.default("ACTIVE"),
    startDate: optionalDate,
    dueDate: optionalDate,
    memberIds: z.array(z.string().min(1)).max(100).default([]),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    message: "Start date cannot be after the due date",
    path: ["startDate"],
  });

export type ProjectInput = z.input<typeof projectSchema>;

export const projectMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  role: PROJECT_ROLE.default("MEMBER"),
});

export const removeMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
});

export const listSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "List name is required").max(60),
});

export const listUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});

export const reorderListsSchema = z.object({
  projectId: z.string().min(1),
  listIds: z.array(z.string().min(1)).min(1),
});

export const moveTaskSchema = z.object({
  id: z.string().min(1),
  /** null moves the task out of every list ("Unsorted"). */
  listId: z.string().min(1).nullable(),
  /** 0-based index inside the target list; omitted = append. */
  index: z.number().int().min(0).optional(),
});

export const milestoneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
  description: optionalText(2000),
  dueDate: optionalDate,
});

export const milestoneUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(120).optional(),
  description: optionalText(2000),
  dueDate: optionalDate,
  completed: z.boolean().optional(),
});

export const dependencySchema = z.object({
  /** The task that is waiting. */
  taskId: z.string().min(1),
  /** The task it waits for. */
  blockerId: z.string().min(1),
});
