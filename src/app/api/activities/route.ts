export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";
import {
  type ActivityListItem,
  metadataToListFields,
  parseActivityMetadata,
} from "@/lib/activities";

/** Published quests for the teacher dashboard — filterable by subject, grade, chapter, topic search. */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = auth.school_id;

    const gradeParam = request.nextUrl.searchParams.get("grade");
    const chapterIdParam = request.nextUrl.searchParams.get("chapter_id");
    const subjectIdParam = request.nextUrl.searchParams.get("subject_id");
    const sectionIdParam = request.nextUrl.searchParams.get("section_id");
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    const grade = gradeParam ? parseInt(gradeParam, 10) : null;
    const chapterId = chapterIdParam ? parseInt(chapterIdParam, 10) : null;
    const subjectId = subjectIdParam ? parseInt(subjectIdParam, 10) : null;
    const sectionId = sectionIdParam ? parseInt(sectionIdParam, 10) : null;

    client = await pool.connect();

    const conditions = ["a.status = 'published'"];
    const values: unknown[] = [];
    let idx = 1;

    if (grade && Number.isInteger(grade)) {
      conditions.push(`c.grade = $${idx++}`);
      values.push(grade);
    }
    if (chapterId && Number.isInteger(chapterId)) {
      conditions.push(`c.id = $${idx++}`);
      values.push(chapterId);
    }
    if (subjectId && Number.isInteger(subjectId)) {
      conditions.push(`c.subject_id = $${idx++}`);
      values.push(subjectId);
    }
    if (q) {
      conditions.push(
        `(a.title ILIKE $${idx} OR c.title ILIKE $${idx} OR c.chapter_code ILIKE $${idx} OR c.anchor_curriculum ILIKE $${idx} OR c.anchor_reference ILIKE $${idx} OR s.name ILIKE $${idx})`,
      );
      values.push(`%${q}%`);
      idx++;
    }

    // School curation: when section is selected, hide disabled quests
    let schoolJoin = "";
    if (sectionId && Number.isInteger(sectionId) && schoolId) {
      schoolJoin = `LEFT JOIN school_content_settings scs
                      ON scs.activity_id = a.id AND scs.school_id = $${idx}`;
      values.push(schoolId);
      idx++;
      conditions.push(`COALESCE(scs.is_enabled, TRUE) = TRUE`);
      // Verify section belongs to school
      conditions.push(
        `EXISTS (
           SELECT 1 FROM sections sec
           JOIN classes cl ON cl.id = sec.class_id
          WHERE sec.id = $${idx} AND cl.school_id = $${idx + 1}
         )`,
      );
      values.push(sectionId, schoolId);
      idx += 2;
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
              c.anchor_curriculum,
              s.id AS subject_id,
              s.slug AS subject_slug,
              s.name AS subject_name,
              (SELECT COUNT(*)::int
                 FROM questions q
                WHERE q.activity_id = a.id AND q.role = 'coach_step') AS coach_step_count
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
         ${schoolJoin}
        WHERE ${conditions.join(" AND ")}
        ORDER BY c.grade, s.name, c.chapter_code, a.sort_order, a.id`,
      values,
    );

    const items: ActivityListItem[] = result.rows.map((row) => {
      const meta = parseActivityMetadata(row.metadata);
      const fields = metadataToListFields(meta, row.ct_skills ?? []);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        ...fields,
        coach_step_count: row.coach_step_count ?? 0,
        estimated_minutes: row.estimated_minutes ?? 15,
        grade: row.grade,
        chapter_title: row.chapter_title,
        chapter_code: row.chapter_code,
        anchor_curriculum: row.anchor_curriculum ?? null,
        subject_id: row.subject_id,
        subject_slug: row.subject_slug,
        subject_name: row.subject_name,
      };
    });

    const first = result.rows[0];
    return NextResponse.json(
      {
        items,
        total: items.length,
        filters: {
          grade: grade ?? null,
          subject_id: subjectId ?? null,
          chapter_id: chapterId ?? null,
          section_id: sectionId ?? null,
          q: q || null,
        },
        chapter: first
          ? {
              code: first.chapter_code,
              title: first.chapter_title,
              grade: first.grade,
              subject_name: first.subject_name,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching activities");
  } finally {
    if (client) client.release();
  }
}
