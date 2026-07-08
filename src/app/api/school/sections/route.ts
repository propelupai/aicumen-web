export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount } from "@/lib/rbac";

/** Active sections for the current academic year (session picker). */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    client = await pool.connect();
    const result = await client.query(
      `SELECT sec.id,
              sec.display_name,
              sec.section_label,
              c.grade,
              c.id AS class_id
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
        WHERE c.school_id = $1
          AND ay.is_current = TRUE
          AND sec.is_active = TRUE
        ORDER BY c.grade, sec.display_name`,
      [schoolId],
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching school sections");
  } finally {
    if (client) client.release();
  }
}
