export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) throw new Error("No idToken in body");

    const adminAuth = getAdminAuth();
    await adminAuth.verifyIdToken(idToken);

    const expiresInMs = 60 * 60 * 24 * 3 * 1000; // 3 days
    const cookie = await adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("__session", cookie, {
      httpOnly: true,
      // NOTE: must be false on http://localhost or the cookie silently won't set.
      secure: isProd,
      sameSite: "lax",
      maxAge: Math.floor(expiresInMs / 1000),
      path: "/",
    });
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("SESSION route error:", message);
    return NextResponse.json({ message: "Session error", detail: message }, { status: 500 });
  }
}
