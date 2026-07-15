export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const RANK_CASE = `MAX(CASE j.level
  WHEN 'got_answer' THEN 1
  WHEN 'got_rule' THEN 2
  WHEN 'able_to_teach' THEN 3
  ELSE 0 END)`;

/** Class-level journal insights for a section: per-activity, per-mandate, per-subject rollups. */
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

    const enrolledRes = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM student_enrollments se
         JOIN users u ON u.user_id = se.user_id
        WHERE se.section_id = $1 AND se.status = 'active' AND u.is_active = TRUE`,
      [sectionId],
    );
    const enrolledCount = enrolledRes.rows[0]?.count ?? 0;

    const activitiesRes = await client.query(
      `SELECT a.id AS activity_id,
              a.title,
              a.metadata->>'quest_code' AS quest_code,
              c.title AS chapter_title,
              su.name AS subject_name,
              COUNT(*) FILTER (WHERE j.level = 'got_answer')::int AS got_answer,
              COUNT(*) FILTER (WHERE j.level = 'got_rule')::int AS got_rule,
              COUNT(*) FILTER (WHERE j.level = 'able_to_teach')::int AS able_to_teach,
              COUNT(*) FILTER (WHERE j.level IS NOT NULL)::int AS assessed,
              MAX(j.updated_at) AS last_updated
         FROM student_activity_journal j
         JOIN activities a ON a.id = j.activity_id
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects su ON su.id = c.subject_id
        WHERE j.section_id = $1
        GROUP BY a.id, a.title, a.metadata, c.title, su.name
        ORDER BY MAX(j.updated_at) DESC NULLS LAST, a.title`,
      [sectionId],
    );

    const mandatesRes = await client.query(
      `WITH student_mandate AS (
         SELECT m.grade, m.code, m.handbook_item, m.unit, m.sort_order,
                j.student_user_id,
                ${RANK_CASE} AS best_rank
           FROM student_activity_journal j
           JOIN activity_cbse_mandates acm ON acm.activity_id = j.activity_id
           JOIN cbse_mandates m
             ON m.grade = acm.mandate_grade AND m.code = acm.mandate_code
          WHERE j.section_id = $1 AND j.level IS NOT NULL
          GROUP BY m.grade, m.code, m.handbook_item, m.unit, m.sort_order, j.student_user_id
       )
       SELECT grade, code, handbook_item, unit,
              COUNT(*) FILTER (WHERE best_rank = 1)::int AS got_answer,
              COUNT(*) FILTER (WHERE best_rank = 2)::int AS got_rule,
              COUNT(*) FILTER (WHERE best_rank = 3)::int AS able_to_teach,
              COUNT(*)::int AS students_assessed
         FROM student_mandate
        GROUP BY grade, code, handbook_item, unit, sort_order
        ORDER BY sort_order, code`,
      [sectionId],
    );

    const subjectsRes = await client.query(
      `WITH student_subject AS (
         SELECT su.id AS subject_id, su.name AS subject_name,
                j.student_user_id,
                ${RANK_CASE} AS best_rank
           FROM student_activity_journal j
           JOIN activities a ON a.id = j.activity_id
           JOIN chapters c ON c.id = a.chapter_id
           JOIN subjects su ON su.id = c.subject_id
          WHERE j.section_id = $1 AND j.level IS NOT NULL
          GROUP BY su.id, su.name, j.student_user_id
       )
       SELECT subject_id, subject_name,
              COUNT(*) FILTER (WHERE best_rank = 1)::int AS got_answer,
              COUNT(*) FILTER (WHERE best_rank = 2)::int AS got_rule,
              COUNT(*) FILTER (WHERE best_rank = 3)::int AS able_to_teach,
              COUNT(*)::int AS students_assessed
         FROM student_subject
        GROUP BY subject_id, subject_name
        ORDER BY subject_name`,
      [sectionId],
    );

    return NextResponse.json(
      {
        section,
        enrolled_count: enrolledCount,
        activities: activitiesRes.rows,
        mandates: mandatesRes.rows,
        subjects: subjectsRes.rows,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching journal summary");
  } finally {
    if (client) client.release();
  }
}
