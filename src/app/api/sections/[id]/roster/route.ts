export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Roster-first view for a section: every enrolled student with their section-scoped
 * mastery counts (got_answer / got_rule / able_to_teach), how many activities they've
 * been assessed on, and when they were last assessed. Powers the Classes area table.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "journal", "write");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    client = await pool.connect();

    const sectionRes = await client.query<{
      section_id: number;
      display_name: string;
      class_name: string;
      grade: number;
      academic_year_label: string;
    }>(
      `SELECT s.id AS section_id, s.display_name, c.name AS class_name, c.grade,
              ay.label AS academic_year_label
         FROM sections s
         JOIN classes c ON c.id = s.class_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
        WHERE s.id = $1 AND s.is_active = TRUE AND c.school_id = $2`,
      [sectionId, schoolId],
    );
    const section = sectionRes.rows[0];
    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    const totalActivitiesRes = await client.query<{ total_activities: number }>(
      `SELECT COUNT(DISTINCT activity_id)::int AS total_activities
         FROM student_activity_journal
        WHERE section_id = $1 AND level IS NOT NULL`,
      [sectionId],
    );
    const totalActivities = totalActivitiesRes.rows[0]?.total_activities ?? 0;

    const studentsRes = await client.query(
      `SELECT u.user_id,
              u.display_name,
              u.email,
              u.username,
              COUNT(*) FILTER (WHERE j.level = 'got_answer')::int AS got_answer,
              COUNT(*) FILTER (WHERE j.level = 'got_rule')::int AS got_rule,
              COUNT(*) FILTER (WHERE j.level = 'able_to_teach')::int AS able_to_teach,
              COUNT(*) FILTER (WHERE j.level IS NOT NULL)::int AS assessed,
              MAX(COALESCE(j.assessed_at, j.updated_at)) AS last_assessed_at
         FROM student_enrollments se
         JOIN users u ON u.user_id = se.user_id
         LEFT JOIN student_activity_journal j
           ON j.student_user_id = u.user_id
          AND j.section_id = se.section_id
          AND j.level IS NOT NULL
        WHERE se.section_id = $1
          AND se.status = 'active'
          AND u.is_active = TRUE
        GROUP BY u.user_id, u.display_name, u.email, u.username
        ORDER BY COALESCE(NULLIF(TRIM(u.display_name), ''), u.email)`,
      [sectionId],
    );

    return NextResponse.json(
      {
        section,
        total_activities: totalActivities,
        enrolled_count: studentsRes.rows.length,
        students: studentsRes.rows,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching section roster");
  } finally {
    if (client) client.release();
  }
}
