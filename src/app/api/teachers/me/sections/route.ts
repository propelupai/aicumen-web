export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount } from "@/lib/rbac";

/** Sections this teacher is assigned to (falls back to all school sections if none). */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    client = await pool.connect();

    const assigned = await client.query(
      `SELECT sec.id,
              sec.display_name,
              sec.section_label,
              c.grade,
              c.id AS class_id,
              cta.is_primary
         FROM class_teacher_assignments cta
         JOIN sections sec ON sec.id = cta.section_id
         JOIN classes c ON c.id = sec.class_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
        WHERE cta.user_id = $1
          AND c.school_id = $2
          AND ay.is_current = TRUE
          AND sec.is_active = TRUE
        ORDER BY cta.is_primary DESC, c.grade, sec.display_name`,
      [auth.user_id, schoolId],
    );

    if (assigned.rows.length > 0) {
      return NextResponse.json(
        { sections: assigned.rows, source: "assigned" as const },
        { status: 200 },
      );
    }

    const all = await client.query(
      `SELECT sec.id,
              sec.display_name,
              sec.section_label,
              c.grade,
              c.id AS class_id,
              FALSE AS is_primary
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
        WHERE c.school_id = $1
          AND ay.is_current = TRUE
          AND sec.is_active = TRUE
        ORDER BY c.grade, sec.display_name`,
      [schoolId],
    );

    return NextResponse.json(
      { sections: all.rows, source: "school" as const },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching teacher sections");
  } finally {
    if (client) client.release();
  }
}
