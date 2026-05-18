import { getMyMonthSchedule } from "@/app/actions/schedule";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { dateKey } from "@/lib/scheduling/dates";

export async function MyScheduleContent({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const data = await getMyMonthSchedule(year, month);

  const assignments = data.shiftRows.map((row) => ({
    doctorId: row.doctorId,
    date: dateKey(row.date),
    shiftTypeId: row.shiftTypeId,
    code: row.shiftType.code,
    color: row.shiftType.color,
    label: row.shiftType.label,
  }));

  return (
    <ScheduleView
      year={year}
      month={month}
      doctors={data.doctors.map((d) => ({
        id: d.id,
        name: d.name,
        targetHours: d.targetHours,
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
      readOnly
      scheduleBasePath="/my-schedule"
    />
  );
}
