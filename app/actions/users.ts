"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@/app/generated/prisma/client";
import { requireUserAdmin } from "@/lib/auth/guards";
import {
  adminUserListRoleFilter,
  canAdminManageUserRole,
} from "@/lib/auth/user-management";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { createUserSchema, setUserPasswordSchema } from "@/lib/schemas/user";

function assertAdminCanManageRole(
  sessionRole: UserRole,
  targetRole: UserRole,
): string | null {
  if (canAdminManageUserRole(sessionRole, targetRole)) return null;
  return "You can only manage doctor login accounts.";
}

export async function listUsers() {
  const session = await requireUserAdmin();
  return prisma.user.findMany({
    where: (() => {
      const roleFilter = adminUserListRoleFilter(session.role);
      return roleFilter ? { role: roleFilter } : undefined;
    })(),
    select: {
      id: true,
      username: true,
      role: true,
      doctorId: true,
      isActive: true,
      createdAt: true,
      doctor: { select: { id: true, name: true } },
    },
    orderBy: { username: "asc" },
  });
}

export async function listDoctorsForUserLink() {
  await requireUserAdmin();
  return prisma.doctor.findMany({
    select: { id: true, name: true, user: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
  doctorId?: string | null;
}) {
  const session = await requireUserAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid user data.",
    };
  }

  const roleError = assertAdminCanManageRole(session.role, parsed.data.role);
  if (roleError) {
    return { ok: false as const, error: roleError };
  }

  const username = parsed.data.username;
  const { password, role } = parsed.data;
  const doctorId = role === "DOCTOR" ? parsed.data.doctorId ?? null : null;

  if (role !== "DOCTOR" && doctorId) {
    return {
      ok: false as const,
      error: "Only doctor accounts can be linked to a roster record.",
    };
  }

  if (doctorId) {
    const linked = await prisma.user.findUnique({
      where: { doctorId },
    });
    if (linked) {
      return { ok: false as const, error: "That doctor already has a login account." };
    }
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { ok: false as const, error: "Username is already taken." };
  }

  await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role,
      doctorId,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function updateUser(
  id: string,
  input: {
    role: UserRole;
    doctorId?: string | null;
    isActive: boolean;
  },
) {
  const session = await requireUserAdmin();

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!existing) {
    return { ok: false as const, error: "User not found." };
  }

  if (session.role === "ADMIN" && existing.role !== "DOCTOR") {
    return { ok: false as const, error: "You can only manage doctor login accounts." };
  }

  const roleError = assertAdminCanManageRole(session.role, input.role);
  if (roleError) {
    return { ok: false as const, error: roleError };
  }

  if (id === session.id && !input.isActive) {
    return { ok: false as const, error: "You cannot deactivate your own account." };
  }

  if (input.role === "DOCTOR" && !input.doctorId) {
    return { ok: false as const, error: "Doctor accounts must be linked to a roster doctor." };
  }
  if (input.role !== "DOCTOR" && input.doctorId) {
    return { ok: false as const, error: "Only doctor accounts can be linked to a roster record." };
  }

  if (input.doctorId) {
    const linked = await prisma.user.findFirst({
      where: { doctorId: input.doctorId, NOT: { id } },
    });
    if (linked) {
      return { ok: false as const, error: "That doctor already has a login account." };
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      role: input.role,
      doctorId: input.role === "DOCTOR" ? input.doctorId : null,
      isActive: input.isActive,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function setUserPassword(userId: string, newPassword: string) {
  const session = await requireUserAdmin();
  const parsed = setUserPasswordSchema.safeParse({ newPassword });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid password.",
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target) {
    return { ok: false as const, error: "User not found." };
  }
  if (session.role === "ADMIN" && target.role !== "DOCTOR") {
    return { ok: false as const, error: "You can only manage doctor login accounts." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      tokenVersion: { increment: 1 },
    },
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}
