import { PageHeaderSkeleton } from "@/components/skeletons/PageHeaderSkeleton";
import { Skeleton } from "@/components/skeletons/Skeleton";

export function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[var(--shadow-card)]">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="divide-y divide-neutral-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-2 p-2">
              <Skeleton className="h-8 w-28 shrink-0" />
              {Array.from({ length: 10 }).map((_, j) => (
                <Skeleton key={j} className="h-8 min-w-[2rem] flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
