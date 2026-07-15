export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ userId: string }> };

const RANK_CASE = `MAX(CASE j.level
  WHEN 'got_answer' THEN 1
  WHEN 'got_rule' THEN 2
  WHEN 'able_to_teach' THEN 3
  ELSE 0 END)`;

/** Student-centric journal insights: overall, by subject, by mandate, plus a timeline. */
export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "journal", "write");

    const { userId } = await context.params;
    const studentId = String(userId ?? "").trim();
    if (!studentId) {
      return NextResponse.json({ message: "Invalid student id" }, { status: 400 });
    }

    client = await pool.connect();

    const studentRes = await client.query<{
      user_id: string;
      display_name: string | null;
      email: string;
      username: string | null;
    }>(
      `SELECT user_id, display_name, email, username
         FROM users
        WHERE user_id = $1 AND school_id = $2 AND account_type = 'student'`,
      [studentId, schoolId],
    );
    const student = studentRes.rows[0];
    if (!student) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    // All journal rows for this student, scoped to the active school via
    // section -> class -> school (chapters has no school_id).
    const schoolScopeJoin = `JOIN sections sec ON sec.id = j.section_id
         JOIN classes cl ON cl.id = sec.class_id`;
    const scope = `j.student_user_id = $1 AND cl.school_id = $2 AND j.level IS NOT NULL`;

    const overallRes = await client.query(
      `SELECT COUNT(*) FILTER (WHERE j.level = 'got_answer')::int AS got_answer,
              COUNT(*) FILTER (WHERE j.level = 'got_rule')::int AS got_rule,
              COUNT(*) FILTER (WHERE j.level = 'able_to_teach')::int AS able_to_teach,
              COUNT(*)::int AS assessed
         FROM student_activity_journal j
         ${schoolScopeJoin}
        WHERE ${scope}`,
      [studentId, schoolId],
    );

    const subjectsRes = await client.query(
      `SELECT su.id AS subject_id, su.name AS subject_name,
              COUNT(*) FILTER (WHERE j.level = 'got_answer')::int AS got_answer,
              COUNT(*) FILTER (WHERE j.level = 'got_rule')::int AS got_rule,
              COUNT(*) FILTER (WHERE j.level = 'able_to_teach')::int AS able_to_teach,
              COUNT(*)::int AS assessed
         FROM student_activity_journal j
         ${schoolScopeJoin}
         JOIN activities a ON a.id = j.activity_id
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects su ON su.id = c.subject_id
        WHERE ${scope}
        GROUP BY su.id, su.name
        ORDER BY su.name`,
      [studentId, schoolId],
    );

    const mandatesRes = await client.query(
      `SELECT m.grade, m.code, m.handbook_item, m.unit,
              ${RANK_CASE} AS best_rank
         FROM student_activity_journal j
         ${schoolScopeJoin}
         JOIN activity_cbse_mandates acm ON acm.activity_id = j.activity_id
         JOIN cbse_mandates m
           ON m.grade = acm.mandate_grade AND m.code = acm.mandate_code
        WHERE ${scope}
        GROUP BY m.grade, m.code, m.handbook_item, m.unit, m.sort_order
        ORDER BY m.sort_order, m.code`,
      [studentId, schoolId],
    );

    const timelineRes = await client.query(
      `SELECT a.id AS activity_id,
              a.title,
              a.metadata->>'quest_code' AS quest_code,
              j.level,
              j.remark,
              j.assessed_at,
              j.updated_at,
              c.title AS chapter_title,
              su.name AS subject_name,
              c.grade,
              sec.display_name AS section_name,
              ay.label AS academic_year_label
         FROM student_activity_journal j
         JOIN activities a ON a.id = j.activity_id
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects su ON su.id = c.subject_id
         JOIN sections sec ON sec.id = j.section_id
         JOIN classes cl ON cl.id = sec.class_id
         JOIN academic_years ay ON ay.id = cl.academic_year_id
        WHERE j.student_user_id = $1 AND cl.school_id = $2
          AND (j.level IS NOT NULL OR j.remark IS NOT NULL)
        ORDER BY COALESCE(j.assessed_at, j.updated_at) DESC
        LIMIT 200`,
      [studentId, schoolId],
    );

    return NextResponse.json(
      {
        student,
        overall: overallRes.rows[0],
        subjects: subjectsRes.rows,
        mandates: mandatesRes.rows,
        timeline: timelineRes.rows,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching student journal");
  } finally {
    if (client) client.release();
  }
}
