import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const userSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]),
  designation: optionalText(80),
  department: optionalText(80),
  phone: optionalText(30),
  password: z
    .string()
    .max(72)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || v.length >= 8, "Password must be at least 8 characters"),
  isActive: z.boolean().default(true),
});

export type UserInput = z.input<typeof userSchema>;
export type UserValues = z.output<typeof userSchema>;
