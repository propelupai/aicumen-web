export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { poolQuery } from "@/lib/db";
import type { AccountType, SchoolRoleKey } from "@/lib/rbac";

export type DbAuthUser = {
  user_id: string;
  role: string | null;
  school_id: number | null;
  display_name: string | null;
  photo_url: string | null;
  school_name: string | null;
  account_type: AccountType;
  platform_role: string | null;
  school_role_key: SchoolRoleKey | null;
  firebase_uid: string;
};

/**
 * Verifies the `__session` cookie with Firebase Admin, then hydrates the DB
 * user row (active school + per-school role). Throws an "unauth"-tagged error
 * when the cookie is missing/invalid so API routes can map it to 401.
 */
export async function getAuthUser(request: NextRequest): Promise<DbAuthUser> {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    throw new Error("Unauthorized: missing session cookie");
  }

  const adminAuth = getAdminAuth();
  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(session, true);
  } catch {
    throw new Error("Unauthorized: invalid or expired session cookie");
  }

  const { rows } = await poolQuery<{
    user_id: string;
    role: string | null;
    school_id: number | null;
    display_name: string | null;
    photo_url: string | null;
    school_name: string | null;
    account_type: AccountType | null;
    platform_role: string | null;
    school_role_key: SchoolRoleKey | null;
  }>(
    `SELECT u.user_id,
            u.role,
            u.school_id,
            u.display_name,
            u.photo_url,
            COALESCE(u.account_type, 'teacher') AS account_type,
            u.platform_role,
            us.role_key AS school_role_key,
            s.name AS school_name
       FROM users u
       LEFT JOIN schools s ON s.id = u.school_id
       LEFT JOIN user_schools us
         ON us.user_id = u.user_id AND us.school_id = u.school_id
      WHERE u.firebase_uid = $1
        AND u.is_active = TRUE`,
    [decoded.uid],
  );

  if (!rows.length) {
    throw new Error("User not found");
  }

  return {
    ...rows[0],
    account_type: rows[0].account_type ?? "teacher",
    firebase_uid: decoded.uid,
  };
}
