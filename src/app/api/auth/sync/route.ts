export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebaseAdmin";

/** Confirm the session cookie belongs to the same account as the sync payload. */
async function verifySessionMatchesSyncBody(
  request: NextRequest,
  firebase_uid: string,
  email: string,
): Promise<NextResponse | null> {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let decoded: { uid: string; email?: string };
  try {
    decoded = await getAdminAuth().verifySessionCookie(session, true);
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (decoded.uid !== firebase_uid) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const bodyEmail = (email || "").trim().toLowerCase();
  const tokenEmail = (decoded.email || "").trim().toLowerCase();
  if (bodyEmail && tokenEmail && bodyEmail !== tokenEmail) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  let client;
  try {
    const { firebase_uid, email, display_name, photo_url } = await request.json();

    if (!firebase_uid || !email) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const photoUrl =
      typeof photo_url === "string" && photo_url.trim() ? photo_url.trim() : null;
    const displayName =
      typeof display_name === "string" && display_name.trim() ? display_name.trim() : null;

    const authErr = await verifySessionMatchesSyncBody(request, firebase_uid, email);
    if (authErr) return authErr;

    client = await pool.connect();

    // Match a pre-seeded row by firebase_uid OR email. No row -> not invited (403).
    const { rows } = await client.query(
      `SELECT * FROM users
        WHERE (firebase_uid = $1 OR email = $2)
          AND is_active = TRUE`,
      [firebase_uid, String(email).trim().toLowerCase()],
    );
    if (rows.length === 0) {
      return NextResponse.json({ message: "Not authorized" }, { status: 403 });
    }

    const user = rows[0];

    const { rows: updated } = await client.query(
      `UPDATE users
          SET firebase_uid = COALESCE(firebase_uid, $1),
              photo_url = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE photo_url END,
              display_name = CASE
                WHEN display_name IS NULL OR BTRIM(display_name) = '' THEN COALESCE($3, display_name)
                ELSE display_name
              END,
              updated_at = NOW()
        WHERE user_id = $4
        RETURNING *`,
      [firebase_uid, photoUrl, displayName, user.user_id],
    );

    return NextResponse.json(updated[0] ?? user, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("unauth")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    console.error("Error syncing user:", message);
    return NextResponse.json({ message: `Internal server error: ${message}` }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
