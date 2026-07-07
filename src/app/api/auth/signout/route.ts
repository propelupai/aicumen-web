export const runtime = "nodejs";
import { NextResponse } from "next/server";

const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("__session", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
