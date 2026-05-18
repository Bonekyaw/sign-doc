import { PageHeaderSkeleton } from "@/components/skeletons/PageHeaderSkeleton";
import { StatCardsSkeleton } from "@/components/skeletons/StatCardsSkeleton";
import { Skeleton } from "@/components/skeletons/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[var(--shadow-card)]">
        <Skeleton className="mb-2 h-6 w-32" />
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
