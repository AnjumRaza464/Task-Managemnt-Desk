import { z } from "zod";

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use the format YYYY-MM-DD");

export const TASK_STATUS = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
]);
export const PRIORITY = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const taskSchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters").max(160),
    description: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .transform((v) => (v ? v : null)),
    assigneeId: z.string().min(1, "Select a user"),
    categoryId: z
      .string()
      .optional()
      .transform((v) => (v ? v : null)),
    priority: PRIORITY.default("MEDIUM"),
    status: TASK_STATUS.default("PENDING"),
    completion: z.coerce.number().int().min(0).max(100).default(0),
    startDate: optionalDate,
    dueDate: dateString,
  })
  .refine(
    (v) => !v.startDate || v.startDate <= v.dueDate,
    { message: "Start date cannot be after due date", path: ["startDate"] },
  );

export type TaskInput = z.input<typeof taskSchema>;
export type TaskValues = z.output<typeof taskSchema>;

export const taskStatusUpdateSchema = z.object({
  id: z.string().min(1),
  status: TASK_STATUS,
});

export const taskCompletionSchema = z.object({
  id: z.string().min(1),
  completion: z.coerce.number().int().min(0).max(100),
});

export const reassignSchema = z.object({
  id: z.string().min(1),
  assigneeId: z.string().min(1),
});

export const subtaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "Subtask title is required").max(160),
});

export const subtaskUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  isCompleted: z.boolean().optional(),
});

export const commentSchema = z.object({
  taskId: z.string().min(1),
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});

export const planSchema = z.object({
  id: z.string().min(1),
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6366f1"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
