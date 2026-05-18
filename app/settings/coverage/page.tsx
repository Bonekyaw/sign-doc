import { Suspense } from "react";
import { CoverageContent } from "@/components/settings/CoverageContent";
import { SettingsFormSkeleton } from "@/components/skeletons/SettingsFormSkeleton";

async function CoveragePageInner({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = Number(params.month) || now.getUTCMonth() + 1;

  return <CoverageContent year={year} month={month} />;
}

export default function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  return (
    <Suspense fallback={<SettingsFormSkeleton rows={6} />}>
      <CoveragePageInner searchParams={searchParams} />
    </Suspense>
  );
}
