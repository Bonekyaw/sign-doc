import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getProxySession } from "@/lib/auth/proxy-session";

const PUBLIC_PATHS = ["/login"];

const ADMIN_PREFIXES = [
  "/",
  "/doctors",
  "/schedule",
  "/settings",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isAdminPath(pathname: string) {
  if (pathname === "/my-schedule" || pathname.startsWith("/my-schedule/")) {
    return false;
  }
  return ADMIN_PREFIXES.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    const session = await getProxySession(request);
    if (session && pathname === "/login") {
      const dest =
        session.role === "DOCTOR" ? "/my-schedule" : "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  const session = await getProxySession(request);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "DOCTOR") {
    const allowed =
      pathname === "/my-schedule" ||
      pathname.startsWith("/my-schedule/");
    if (!allowed) {
      return NextResponse.redirect(new URL("/my-schedule", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/settings/users")) {
    if (session.role !== "ADMIN" && session.role !== "OWNER") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (pathname === "/my-schedule" || pathname.startsWith("/my-schedule/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
