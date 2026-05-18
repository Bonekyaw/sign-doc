import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Skeleton } from "@/components/skeletons/Skeleton";

async function LoginPageInner({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm nextPath={params.next} initialError={params.error} />
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[var(--shadow-card)]">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageInner searchParams={searchParams} />
    </Suspense>
  );
}
