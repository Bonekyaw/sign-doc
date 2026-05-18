import { SignJWT, jwtVerify } from "jose";
import type { User } from "@/app/generated/prisma/client";
import { ACCESS_TOKEN_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import type { SessionPayload } from "@/lib/auth/types";

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters. Generate with: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(secret);
}

export function createSessionToken(user: Pick<User, "id" | "username" | "role" | "doctorId" | "tokenVersion">) {
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    doctorId: user.doctorId,
    tokenVersion: user.tokenVersion,
  };

  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;

    const role = payload.role;
    const username = payload.username;
    const tokenVersion = payload.tokenVersion;

    if (
      typeof role !== "string" ||
      typeof username !== "string" ||
      typeof tokenVersion !== "number"
    ) {
      return null;
    }

    return {
      sub,
      username,
      role: role as SessionPayload["role"],
      doctorId:
        payload.doctorId === null || typeof payload.doctorId === "string"
          ? (payload.doctorId as string | null)
          : null,
      tokenVersion,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: ACCESS_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export { ACCESS_TOKEN_COOKIE };
