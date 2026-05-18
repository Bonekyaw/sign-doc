"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@/app/generated/prisma/client";
import { requireOwner } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export async function listUsers() {
  await requireOwner();
  return prisma.user.findMany({
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
  await requireOwner();
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
  await requireOwner();

  const username = input.username.trim();
  if (!username || username.length < 2) {
    return { ok: false as const, error: "Username must be at least 2 characters." };
  }
  if (input.password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }

  if (input.role === "DOCTOR" && !input.doctorId) {
    return { ok: false as const, error: "Doctor accounts must be linked to a roster doctor." };
  }
  if (input.role !== "DOCTOR" && input.doctorId) {
    return { ok: false as const, error: "Only doctor accounts can be linked to a roster record." };
  }

  if (input.doctorId) {
    const linked = await prisma.user.findUnique({
      where: { doctorId: input.doctorId },
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
      passwordHash: await hashPassword(input.password),
      role: input.role,
      doctorId: input.role === "DOCTOR" ? input.doctorId : null,
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
  const session = await requireOwner();

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
  await requireOwner();

  if (newPassword.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      tokenVersion: { increment: 1 },
    },
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}
