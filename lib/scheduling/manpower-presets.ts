import { prisma } from "@/lib/db";
import {
  formatManpowerRatio,
  mergeManpowerPresets,
  ratioPresetId,
  type ManpowerRatioOption,
} from "@/lib/scheduling/constants";

export async function loadCustomManpowerPresets(): Promise<ManpowerRatioOption[]> {
  const rows = await prisma.manpowerRatioPreset.findMany({
    orderBy: [{ sortOrder: "asc" }, { dayShiftTarget: "asc" }, { nightShiftTarget: "asc" }],
  });

  return rows.map((row) => ({
    id: ratioPresetId(row.dayShiftTarget, row.nightShiftTarget),
    dayShiftTarget: row.dayShiftTarget,
    nightShiftTarget: row.nightShiftTarget,
    label: row.label ?? formatManpowerRatio(row.dayShiftTarget, row.nightShiftTarget),
    dbId: row.id,
  }));
}

export async function loadAllManpowerPresets(): Promise<ManpowerRatioOption[]> {
  const custom = await loadCustomManpowerPresets();
  return mergeManpowerPresets(custom);
}
