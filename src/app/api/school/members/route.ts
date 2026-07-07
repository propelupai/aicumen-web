export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

/** Staff members for the active school (teachers + school admins). */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "user", "assign_role");

    client = await pool.connect();
    const result = await client.query(
      `SELECT u.user_id,
              u.email,
              u.display_name,
              u.photo_url,
              u.firebase_uid IS NOT NULL AS has_signed_in,
              us.role_key,
              us.joined_at
         FROM user_schools us
         JOIN users u ON u.user_id = us.user_id
        WHERE us.school_id = $1
          AND u.account_type = 'teacher'
          AND u.is_active = TRUE
          AND us.role_key IN ('teacher', 'school_admin')
        ORDER BY us.joined_at`,
      [schoolId],
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching school members");
  } finally {
    if (client) client.release();
  }
}
