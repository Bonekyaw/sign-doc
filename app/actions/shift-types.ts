"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { shiftTypesTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import { requireAdminRead, requireWrite } from "@/lib/auth/guards";

export async function listShiftTypes() {
  await requireAdminRead();
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
  await requireWrite();
  await prisma.shiftTypeConfig.update({ where: { id }, data });
  revalidatePath("/settings/shift-types");
  revalidatePath("/schedule");
  revalidateTag(shiftTypesTag(), "max");
}
