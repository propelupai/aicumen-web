export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    client = await pool.connect();

    const yearResult = await client.query(
      `SELECT id, label FROM academic_years
        WHERE school_id = $1 AND is_current = TRUE
        LIMIT 1`,
      [schoolId],
    );
    const currentYear = yearResult.rows[0] ?? null;

    let classCount = 0;
    let sectionCount = 0;
    if (currentYear) {
      const counts = await client.query(
        `SELECT
           COUNT(DISTINCT c.id)::int AS class_count,
           COUNT(s.id) FILTER (WHERE s.is_active = TRUE)::int AS section_count
         FROM classes c
         LEFT JOIN sections s ON s.class_id = c.id
        WHERE c.school_id = $1 AND c.academic_year_id = $2`,
        [schoolId, currentYear.id],
      );
      classCount = counts.rows[0]?.class_count ?? 0;
      sectionCount = counts.rows[0]?.section_count ?? 0;
    }

    return NextResponse.json(
      {
        school_id: schoolId,
        school_name: auth.school_name,
        school_role_key: auth.school_role_key,
        academic_year: currentYear,
        class_count: classCount,
        section_count: sectionCount,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching school overview");
  } finally {
    if (client) client.release();
  }
}
