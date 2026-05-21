import { getMyMonthSchedule } from "@/app/actions/schedule";
import { loadMainFlowSchedulingRules } from "@/lib/scheduling/context";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { dateKey } from "@/lib/scheduling/dates";

export async function MyScheduleContent({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const [data, rules] = await Promise.all([
    getMyMonthSchedule(year, month),
    loadMainFlowSchedulingRules(),
  ]);

  const shiftTypes = data.shiftTypes.map((t) => ({
    id: t.id,
    code: t.code,
    label: t.label,
    color: t.color,
    durationHours: t.durationHours,
    isActive: t.isActive,
  }));

  if (!data.published) {
    return (
      <ScheduleView
        year={year}
        month={month}
        doctors={[]}
        shiftTypes={shiftTypes}
        assignments={[]}
        monthKeys={data.monthKeys}
        coverageByDate={[]}
        hourSummary={[]}
        readOnly
        doctorPortal
        scheduleBasePath="/my-schedule"
        monthStatus={data.monthStatus}
        publishedAt={data.publishedAt}
        unpublishedMessage={data.message ?? "Schedule not published."}
        seniorRules={{
          requireSeniorOnDayBand: rules.requireSeniorOnDayBand,
          requireSeniorOnNightBand: rules.requireSeniorOnNightBand,
        }}
      />
    );
  }

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
      shiftTypes={shiftTypes}
      assignments={assignments}
      monthKeys={data.monthKeys}
      coverageByDate={data.coverageByDate}
      hourSummary={data.hourSummary}
      readOnly
      doctorPortal
      viewerDoctorId={data.viewerDoctorId}
      scheduleBasePath="/my-schedule"
      monthStatus={data.monthStatus}
      publishedAt={data.publishedAt}
      seniorRules={{
        requireSeniorOnDayBand: rules.requireSeniorOnDayBand,
        requireSeniorOnNightBand: rules.requireSeniorOnNightBand,
      }}
    />
  );
}
