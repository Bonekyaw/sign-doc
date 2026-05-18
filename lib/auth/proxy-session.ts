import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/types";

export async function getProxySession(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
