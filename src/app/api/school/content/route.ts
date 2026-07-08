export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

/** Published catalog with per-school enable flags for curation UI. */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "content", "curate");

    const gradeParam = request.nextUrl.searchParams.get("grade");
    const grade = gradeParam ? parseInt(gradeParam, 10) : null;

    client = await pool.connect();

    const conditions = ["a.status = 'published'"];
    const values: unknown[] = [schoolId];
    let idx = 2;

    if (grade && Number.isInteger(grade)) {
      conditions.push(`c.grade = $${idx++}`);
      values.push(grade);
    }

    const result = await client.query(
      `SELECT a.id,
              a.slug,
              a.title,
              a.sort_order,
              a.estimated_minutes,
              a.ct_skills,
              a.metadata,
              c.grade,
              c.chapter_code,
              c.title AS chapter_title,
              s.name AS subject_name,
              COALESCE(scs.is_enabled, TRUE) AS is_enabled,
              scs.sort_override
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
         LEFT JOIN school_content_settings scs
           ON scs.activity_id = a.id AND scs.school_id = $1
        WHERE ${conditions.join(" AND ")}
        ORDER BY COALESCE(scs.sort_override, a.sort_order), a.id`,
      values,
    );

    const tracks = await client.query(
      `SELECT t.*, s.name AS subject_name
         FROM curriculum_tracks t
         LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE t.is_active = TRUE
        ORDER BY t.label`,
    );

    const sections = await client.query(
      `SELECT sec.id,
              sec.display_name,
              sec.section_label,
              c.grade,
              st.track_id,
              t.label AS track_label
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         LEFT JOIN section_tracks st ON st.section_id = sec.id
         LEFT JOIN curriculum_tracks t ON t.id = st.track_id
        WHERE c.school_id = $1
          AND sec.is_active = TRUE
          AND ay.is_current = TRUE
        ORDER BY c.grade, sec.display_name`,
      [schoolId],
    );

    return NextResponse.json(
      {
        activities: result.rows,
        tracks: tracks.rows,
        sections: sections.rows,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching school content");
  } finally {
    if (client) client.release();
  }
}
