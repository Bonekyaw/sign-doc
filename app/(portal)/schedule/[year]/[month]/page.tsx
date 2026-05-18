import { Suspense } from "react";
import { ScheduleMonthContent } from "@/components/schedule/ScheduleMonthContent";
import { ScheduleSkeleton } from "@/components/skeletons/ScheduleSkeleton";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year: y, month: m } = await params;
  const year = Number(y);
  const month = Number(m);

  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <ScheduleMonthContent year={year} month={month} />
    </Suspense>
  );
}
