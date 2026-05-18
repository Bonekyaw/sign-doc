"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { rotationTemplatesTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import { rotationTemplateSchema } from "@/lib/schemas/rotation";
import type { RotationStepType } from "@/lib/scheduling/rotation";
import { requireAdminRead, requireWrite } from "@/lib/auth/guards";

export async function listRotationTemplates() {
  await requireAdminRead();
  return prisma.rotationTemplate.findMany({
    include: { steps: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function createRotationTemplate(data: {
  name: string;
  steps: { stepType: RotationStepType }[];
}) {
  await requireWrite();
  const parsed = rotationTemplateSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid template.");
  }

  await prisma.rotationTemplate.create({
    data: {
      name: data.name,
      steps: {
        create: data.steps.map((s, i) => ({
          sortOrder: i,
          stepType: s.stepType,
        })),
      },
    },
  });
  revalidatePath("/settings/rotation-templates");
  revalidateTag(rotationTemplatesTag(), "max");
}

export async function updateRotationTemplate(
  id: string,
  data: { name: string; steps: { stepType: RotationStepType }[] },
) {
  await requireWrite();
  const parsed = rotationTemplateSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid template.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.rotationTemplateStep.deleteMany({ where: { templateId: id } });
    await tx.rotationTemplate.update({
      where: { id },
      data: {
        name: data.name,
        steps: {
          create: data.steps.map((s, i) => ({
            sortOrder: i,
            stepType: s.stepType,
          })),
        },
      },
    });
  });
  revalidatePath("/settings/rotation-templates");
  revalidateTag(rotationTemplatesTag(), "max");
}

export async function deleteRotationTemplate(id: string) {
  await requireWrite();
  const inUse = await prisma.doctorRotation.count({
    where: { templateId: id },
  });
  if (inUse > 0) {
    throw new Error("Template is assigned to doctors and cannot be deleted.");
  }
  await prisma.rotationTemplate.delete({ where: { id } });
  revalidatePath("/settings/rotation-templates");
  revalidateTag(rotationTemplatesTag(), "max");
}
