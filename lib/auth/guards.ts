import { cookies } from "next/headers";
import type { UserRole } from "@/app/generated/prisma/client";
import { AuthError } from "@/lib/auth/errors";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db";

async function resolveSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      role: true,
      doctorId: true,
      tokenVersion: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;
  if (user.tokenVersion !== payload.tokenVersion) return null;

  if (user.role === "DOCTOR" && !user.doctorId) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    doctorId: user.doctorId,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  return resolveSession();
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await resolveSession();
  if (!session) {
    throw new AuthError("You must be signed in.", "UNAUTHORIZED");
  }
  return session;
}

export async function requireRole(
  roles: UserRole[],
): Promise<SessionUser> {
  const session = await requireAuth();
  if (!roles.includes(session.role)) {
    throw new AuthError("You do not have permission to perform this action.", "FORBIDDEN");
  }
  return session;
}

export async function requireWrite(): Promise<SessionUser> {
  return requireRole(["ADMIN", "OWNER"]);
}

export async function requireOwner(): Promise<SessionUser> {
  return requireRole(["OWNER"]);
}

export async function requireAdminRead(): Promise<SessionUser> {
  return requireRole(["ADMIN", "OWNER"]);
}

export async function requireDoctor(): Promise<SessionUser & { doctorId: string }> {
  const session = await requireRole(["DOCTOR"]);
  if (!session.doctorId) {
    throw new AuthError("Doctor account is not linked to a roster record.", "FORBIDDEN");
  }
  return { ...session, doctorId: session.doctorId };
}

export function assertDoctorSelf(
  session: SessionUser,
  doctorId: string,
): void {
  if (session.role === "DOCTOR" && session.doctorId !== doctorId) {
    throw new AuthError("You can only access your own schedule.", "FORBIDDEN");
  }
}

export function canWrite(role: UserRole): boolean {
  return role === "ADMIN" || role === "OWNER";
}
