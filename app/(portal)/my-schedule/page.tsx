import { Suspense } from "react";
import { connection } from "next/server";
import { MyScheduleContent } from "@/components/schedule/MyScheduleContent";
import { ScheduleSkeleton } from "@/components/skeletons/ScheduleSkeleton";

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = Number(params.month) || now.getUTCMonth() + 1;

  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <MyScheduleContent year={year} month={month} />
    </Suspense>
  );
}
