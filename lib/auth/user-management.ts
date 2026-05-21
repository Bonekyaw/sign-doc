import type { UserRole } from "@/app/generated/prisma/client";

export function canAdminManageUserRole(
  sessionRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (sessionRole === "OWNER") return true;
  return targetRole === "DOCTOR";
}

export function adminUserListRoleFilter(
  sessionRole: UserRole,
): UserRole | undefined {
  return sessionRole === "ADMIN" ? "DOCTOR" : undefined;
}
