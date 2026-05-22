"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { manpowerPresetsTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import {
  BUILTIN_MANPOWER_PRESETS,
  formatManpowerRatio,
  isValidManpowerRatio,
} from "@/lib/scheduling/constants";
import {
  loadAllManpowerPresets,
  loadCustomManpowerPresets,
} from "@/lib/scheduling/manpower-presets";
import { manpowerRatioInputSchema } from "@/lib/schemas/manpower-preset";
import { requireAdminRead, requireWrite } from "@/lib/auth/guards";

function revalidateManpowerPresets() {
  revalidateTag(manpowerPresetsTag(), "max");
  revalidatePath("/settings/coverage");
}

function isBuiltInRatio(dayShiftTarget: number, nightShiftTarget: number) {
  return BUILTIN_MANPOWER_PRESETS.some(
    (p) =>
      p.dayShiftTarget === dayShiftTarget &&
      p.nightShiftTarget === nightShiftTarget,
  );
}

export async function listManpowerPresets() {
  await requireAdminRead();
  return loadAllManpowerPresets();
}

export async function createManpowerPreset(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireWrite();
  const parsed = manpowerRatioInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid ratio.",
    };
  }

  const { dayShiftTarget, nightShiftTarget, label } = parsed.data;
  if (!isValidManpowerRatio(dayShiftTarget, nightShiftTarget)) {
    return { ok: false, error: "Invalid Long day / Night counts." };
  }

  if (isBuiltInRatio(dayShiftTarget, nightShiftTarget)) {
    return {
      ok: false,
      error: `${formatManpowerRatio(dayShiftTarget, nightShiftTarget)} is already a built-in preset.`,
    };
  }

  const existing = await prisma.manpowerRatioPreset.findFirst({
    where: { dayShiftTarget, nightShiftTarget },
  });
  if (existing) {
    return {
      ok: false,
      error: `${formatManpowerRatio(dayShiftTarget, nightShiftTarget)} is already saved.`,
    };
  }

  const maxSort = await prisma.manpowerRatioPreset.aggregate({
    _max: { sortOrder: true },
  });

  await prisma.manpowerRatioPreset.create({
    data: {
      dayShiftTarget,
      nightShiftTarget,
      label: label || formatManpowerRatio(dayShiftTarget, nightShiftTarget),
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidateManpowerPresets();
  return { ok: true };
}

export async function deleteManpowerPreset(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireWrite();

  const row = await prisma.manpowerRatioPreset.findUnique({ where: { id } });
  if (!row) {
    return { ok: false, error: "Preset not found." };
  }

  if (isBuiltInRatio(row.dayShiftTarget, row.nightShiftTarget)) {
    return { ok: false, error: "Built-in presets cannot be removed." };
  }

  await prisma.manpowerRatioPreset.delete({ where: { id } });
  revalidateManpowerPresets();
  return { ok: true };
}

export async function listCustomManpowerPresetsForAdmin() {
  await requireAdminRead();
  return loadCustomManpowerPresets();
}
