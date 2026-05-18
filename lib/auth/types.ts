import type { UserRole } from "@/app/generated/prisma/client";

export type SessionUser = {
  id: string;
  username: string;
  role: UserRole;
  doctorId: string | null;
};

export type SessionPayload = {
  sub: string;
  username: string;
  role: UserRole;
  doctorId: string | null;
  tokenVersion: number;
};
