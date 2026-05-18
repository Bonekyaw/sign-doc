"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { doctorsTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import { defaultTargetHours, parseDateKey } from "@/lib/scheduling/dates";
import { doctorSchema } from "@/lib/schemas/doctor";
import type { DoctorType } from "@/app/generated/prisma/client";
import { requireAdminRead, requireWrite } from "@/lib/auth/guards";

export async function listDoctors() {
  await requireAdminRead();
  return prisma.doctor.findMany({
    include: {
      restrictions: true,
      rotation: {
        include: { template: { include: { steps: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
    orderBy: { name: "asc" },
  });
}

async function upsertDoctorRotation(
  doctorId: string,
  templateId: string | null | undefined,
  startDateStr: string | null | undefined,
) {
  await prisma.doctorRotation.deleteMany({ where: { doctorId } });
  if (templateId && startDateStr) {
    await prisma.doctorRotation.create({
      data: {
        doctorId,
        templateId,
        startDate: parseDateKey(startDateStr),
        startOffset: 0,
      },
    });
  }
}

export async function createDoctor(input: {
  name: string;
  type: DoctorType;
  monthlyHourLimit?: number;
  targetHours?: number;
  girlsOff24h?: boolean;
  noTwentyFour?: boolean;
  rotationTemplateId?: string | null;
  rotationStartDate?: string | null;
}) {
  await requireWrite();
  const girlsOff = input.girlsOff24h ?? input.noTwentyFour ?? false;
  const limit =
    input.monthlyHourLimit ??
    input.targetHours ??
    defaultTargetHours(input.type as "FT" | "HALF_TIME" | "PT");

  const parsed = doctorSchema.safeParse({
    name: input.name,
    type: input.type,
    monthlyHourLimit: limit,
    girlsOff24h: girlsOff,
    rotationTemplateId: input.rotationTemplateId ?? null,
    rotationStartDate: input.rotationStartDate ?? null,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid doctor.");
  }

  const doctor = await prisma.doctor.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      targetHours: parsed.data.monthlyHourLimit,
      restrictions: parsed.data.girlsOff24h
        ? { create: [{ type: "NO_TWENTY_FOUR" }] }
        : undefined,
    },
    include: { restrictions: true },
  });

  await upsertDoctorRotation(
    doctor.id,
    parsed.data.rotationTemplateId,
    parsed.data.rotationStartDate,
  );

  revalidatePath("/doctors");
  revalidatePath("/schedule");
  revalidateTag(doctorsTag(), "max");
  return doctor;
}

export async function updateDoctor(
  id: string,
  input: {
    name: string;
    type: DoctorType;
    monthlyHourLimit?: number;
    targetHours?: number;
    girlsOff24h?: boolean;
    noTwentyFour?: boolean;
    rotationTemplateId?: string | null;
    rotationStartDate?: string | null;
  },
) {
  await requireWrite();
  const girlsOff = input.girlsOff24h ?? input.noTwentyFour ?? false;
  const limit = input.monthlyHourLimit ?? input.targetHours ?? 240;

  const parsed = doctorSchema.safeParse({
    name: input.name,
    type: input.type,
    monthlyHourLimit: limit,
    girlsOff24h: girlsOff,
    rotationTemplateId: input.rotationTemplateId ?? null,
    rotationStartDate: input.rotationStartDate ?? null,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid doctor.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.doctor.update({
      where: { id },
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        targetHours: parsed.data.monthlyHourLimit,
      },
    });
    await tx.doctorRestriction.deleteMany({ where: { doctorId: id } });
    if (parsed.data.girlsOff24h) {
      await tx.doctorRestriction.create({
        data: { doctorId: id, type: "NO_TWENTY_FOUR" },
      });
    }
  });

  await upsertDoctorRotation(
    id,
    parsed.data.rotationTemplateId,
    parsed.data.rotationStartDate,
  );

  revalidatePath("/doctors");
  revalidatePath("/schedule");
  revalidateTag(doctorsTag(), "max");
}

export async function deleteDoctor(id: string) {
  await requireWrite();
  await prisma.doctor.delete({ where: { id } });
  revalidatePath("/doctors");
  revalidatePath("/schedule");
  revalidateTag(doctorsTag(), "max");
}
