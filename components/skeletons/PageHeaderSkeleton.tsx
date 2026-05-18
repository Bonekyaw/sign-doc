import { Skeleton } from "@/components/skeletons/Skeleton";

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2 border-b border-neutral-200/80 pb-6">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-48 sm:h-9" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}
