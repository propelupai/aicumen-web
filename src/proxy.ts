import { NextResponse, type NextRequest } from "next/server";

/** Lightweight guard: dashboard routes need a session cookie (full verify in API routes). */
export function proxy(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
