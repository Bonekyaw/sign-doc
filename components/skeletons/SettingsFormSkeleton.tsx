import { PageHeaderSkeleton } from "@/components/skeletons/PageHeaderSkeleton";
import { Skeleton } from "@/components/skeletons/Skeleton";

export function SettingsFormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[var(--shadow-card)]"
          >
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
