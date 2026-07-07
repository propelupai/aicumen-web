export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "read");

    client = await pool.connect();
    const result = await client.query(
      `SELECT u.user_id,
              u.display_name,
              u.email,
              u.username,
              se.section_id AS active_section_id,
              ss.section_display_name AS active_section_name
         FROM users u
         LEFT JOIN student_enrollments se
           ON se.user_id = u.user_id AND se.status = 'active'
         LEFT JOIN section_schools ss
           ON ss.section_id = se.section_id
        WHERE u.school_id = $1
          AND u.account_type = 'student'
          AND u.is_active = TRUE
        ORDER BY COALESCE(NULLIF(TRIM(u.display_name), ''), u.email)`,
      [schoolId],
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching students");
  } finally {
    if (client) client.release();
  }
}
