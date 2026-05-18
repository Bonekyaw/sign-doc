import { getMonthSettings } from "@/app/actions/coverage";
import { CoverageEditor } from "@/components/settings/CoverageEditor";
import { getMonthDateKeys } from "@/lib/scheduling/dates";

export async function CoverageContent({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const settings = await getMonthSettings(year, month);
  const monthKeys = getMonthDateKeys(year, month);

  return (
    <CoverageEditor
      year={year}
      month={month}
      dayTarget={settings?.dayShiftTarget ?? 4}
      nightTarget={settings?.nightShiftTarget ?? 3}
      monthKeys={monthKeys}
    />
  );
}
