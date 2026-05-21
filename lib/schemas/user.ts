import { z } from "zod";

export const createUserSchema = z
  .object({
    username: z.string().trim().min(2, "Username must be at least 2 characters."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    role: z.enum(["ADMIN", "OWNER", "DOCTOR"]),
    doctorId: z.string().optional(),
  })
  .refine(
    (data) => data.role !== "DOCTOR" || (data.doctorId && data.doctorId.length > 0),
    {
      message: "Doctor accounts must be linked to a roster doctor.",
      path: ["doctorId"],
    },
  );

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setUserPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export type SetUserPasswordInput = z.infer<typeof setUserPasswordSchema>;
