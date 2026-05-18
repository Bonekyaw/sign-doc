"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { shiftTypesTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";

export async function listShiftTypes() {
  return prisma.shiftTypeConfig.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function updateShiftType(
  id: string,
  data: {
    label: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    color: string;
    isActive: boolean;
  },
) {
  await prisma.shiftTypeConfig.update({ where: { id }, data });
  revalidatePath("/settings/shift-types");
  revalidatePath("/schedule");
  revalidateTag(shiftTypesTag(), "max");
}
