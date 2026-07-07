export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { pool } from "@/lib/db";

/**
 * Verifies the `__session` cookie with Firebase Admin, then hydrates the DB
 * user row (joined to their school). Throws an "unauth"-tagged error when the
 * cookie is missing/invalid so API routes can map it to 401.
 */
export async function getAuthUser(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    throw new Error("Unauthorized: missing session cookie");
  }

  const adminAuth = getAdminAuth();
  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(session, true); // checkRevoked
  } catch {
    throw new Error("Unauthorized: invalid or expired session cookie");
  }

  const { rows } = await pool.query(
    `SELECT u.user_id, u.role, u.school_id, u.display_name, u.photo_url,
            s.name AS school_name
       FROM users u
       LEFT JOIN schools s ON s.id = u.school_id
      WHERE u.firebase_uid = $1
        AND u.is_active = TRUE`,
    [decoded.uid],
  );

  if (!rows.length) {
    throw new Error("User not found");
  }

  return {
    ...rows[0],
    firebase_uid: decoded.uid,
  } as {
    user_id: string;
    role: string | null;
    school_id: number;
    display_name: string | null;
    photo_url: string | null;
    school_name: string | null;
    firebase_uid: string;
  };
}
