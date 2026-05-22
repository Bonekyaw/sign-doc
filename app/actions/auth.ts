"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLoginRedirectPath } from "@/lib/auth/login-redirect";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  sessionCookieOptions,
  ACCESS_TOKEN_COOKIE,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const INVALID_CREDENTIALS = "Invalid username or password.";

export type LoginFormState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();

  if (!username || !password) {
    return { error: INVALID_CREDENTIALS };
  }

  const user = await prisma.user.findUnique({ where: { username } });

  const passwordHash =
    user?.passwordHash ??
    "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  const valid = await verifyPassword(password, passwordHash);
  if (!user || !valid || !user.isActive) {
    return { error: INVALID_CREDENTIALS };
  }

  if (user.role === "DOCTOR" && !user.doctorId) {
    return { error: INVALID_CREDENTIALS };
  }

  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions(token));

  redirect(getLoginRedirectPath(user.role, next));
}

/** @deprecated Use loginAction with useActionState */
export async function login(formData: FormData) {
  return loginAction({}, formData);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  redirect("/login");
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
) {
  const { requireAuth } = await import("@/lib/auth/guards");
  const session = await requireAuth();

  if (newPassword.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
  });

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { ok: false as const, error: "Current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      tokenVersion: { increment: 1 },
    },
  });

  const token = await createSessionToken({
    id: user.id,
    username: user.username,
    role: user.role,
    doctorId: user.doctorId,
    tokenVersion: user.tokenVersion + 1,
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions(token));

  return { ok: true as const };
}
