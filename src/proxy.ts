import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

const secret = new TextEncoder().encode(jwtSecret);

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  let isAuth = false;

  if (token) {
    try {
      await jwtVerify(token, secret);
      isAuth = true;
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
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/professionnel/:path*", "/login", "/register"],
};
