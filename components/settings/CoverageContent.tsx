import { getMonthSettings } from "@/app/actions/coverage";
import { listManpowerPresets } from "@/app/actions/manpower-presets";
import { CoverageEditor } from "@/components/settings/CoverageEditor";
import { canWrite, getSession } from "@/lib/auth/guards";
import { getDailyCoverageOverrides } from "@/lib/scheduling/context";
import { getMonthDateKeys } from "@/lib/scheduling/dates";

export async function CoverageContent({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const session = await getSession();
  const [settings, presets, dailyOverrides] = await Promise.all([
    getMonthSettings(year, month),
    listManpowerPresets(),
    getDailyCoverageOverrides(year, month),
  ]);
  const monthKeys = getMonthDateKeys(year, month);

  return (
    <CoverageEditor
      year={year}
      month={month}
      dayTarget={settings?.dayShiftTarget ?? 4}
      nightTarget={settings?.nightShiftTarget ?? 3}
      monthKeys={monthKeys}
      presets={presets}
      dailyOverrides={Object.fromEntries(dailyOverrides.entries())}
      canWrite={session ? canWrite(session.role) : false}
    />
  );
}
