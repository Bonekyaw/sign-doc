import { Suspense } from "react";
import { connection } from "next/server";
import { AdminShell } from "@/components/layout/AdminShell";
import { getSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  await connection();
  const session = await getSession();
  const doctorCount =
    session?.role === "ADMIN" || session?.role === "OWNER"
      ? await prisma.doctor.count()
      : undefined;
  return (
    <AdminShell
      session={session}
      doctorCount={doctorCount}
      minimal={session?.role === "DOCTOR"}
    >
      {children}
    </AdminShell>
  );
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminShell session={null} />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
