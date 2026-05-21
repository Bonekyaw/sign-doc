import { getMonthSchedule } from "@/app/actions/schedule";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { canWrite, getSession } from "@/lib/auth/guards";
import { loadMainFlowSchedulingRules } from "@/lib/scheduling/context";
import { dateKey } from "@/lib/scheduling/dates";

export async function ScheduleMonthContent({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const session = await getSession();
  const [data, rules] = await Promise.all([
    getMonthSchedule(year, month),
    loadMainFlowSchedulingRules(),
  ]);
  const writable = session ? canWrite(session.role) : false;
  const isPublished = data.monthStatus === "PUBLISHED";

  const assignments = data.shiftRows.map((row) => ({
    doctorId: row.doctorId,
    date: dateKey(row.date),
    shiftTypeId: row.shiftTypeId,
    code: row.shiftType.code,
    color: row.shiftType.color,
    label: row.shiftType.label,
    source: row.source as "MANUAL" | "AUTO",
  }));

  return (
    <ScheduleView
      year={year}
      month={month}
      doctors={data.doctors.map((d) => ({
        id: d.id,
        name: d.name,
        targetHours: d.targetHours,
        seniority: d.seniority,
      }))}
      shiftTypes={data.shiftTypes.map((t) => ({
        id: t.id,
        code: t.code,
        label: t.label,
        color: t.color,
        durationHours: t.durationHours,
        isActive: t.isActive,
      }))}
      assignments={assignments}
      monthKeys={data.monthKeys}
      coverageByDate={data.coverageByDate}
      hourSummary={data.hourSummary}
      readOnly={!writable}
      publishedEditMode={writable && isPublished}
      monthStatus={data.monthStatus}
      publishedAt={data.publishedAt}
      manualCount={data.manualCount}
      autoCount={data.autoCount}
      seniorRules={{
        requireSeniorOnDayBand: rules.requireSeniorOnDayBand,
        requireSeniorOnNightBand: rules.requireSeniorOnNightBand,
      }}
    />
  );
}
