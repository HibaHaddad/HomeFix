import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/app/lib/prisma";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

const secret = new TextEncoder().encode(jwtSecret);

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  let isAuth = false;
  let userId = 0;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      if (typeof payload.userId === "number" && Number.isSafeInteger(payload.userId) && payload.userId > 0 && payload.userId <= 2147483647) {
        userId = payload.userId;
        isAuth = true;
      }
    } catch {
      isAuth = false;
    }
  }

  const { pathname } = req.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/professionnel")) && !isAuth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAuthPage && isAuth) {
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true, isSuspended: true } });
    if (!actor || actor.isSuspended || (actor.role === "CLIENT" && actor.status !== "ACTIVE") || (actor.role === "PROFESSIONAL" && actor.status !== "APPROVED")) {
      const response = NextResponse.next();
      response.cookies.delete("session");
      return response;
    }
    return NextResponse.redirect(new URL(actor.role === "ADMIN" ? "/admin" : "/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/professionnel/:path*", "/login", "/register"],
};
