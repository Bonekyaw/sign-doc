import { Suspense } from "react";
import { connection } from "next/server";
import { AdminShell } from "@/components/layout/AdminShell";
import { getSession } from "@/lib/auth/guards";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  await connection();
  const session = await getSession();
  return <AdminShell session={session}>{children}</AdminShell>;
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <AdminShell session={null}>{children}</AdminShell>
      }
    >
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
