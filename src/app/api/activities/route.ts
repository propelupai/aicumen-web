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

/** Published activities for the teacher dashboard (global content catalog). */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    const gradeParam = request.nextUrl.searchParams.get("grade");
    const chapterCode = request.nextUrl.searchParams.get("chapter_code");
    const grade = gradeParam ? parseInt(gradeParam, 10) : null;

    client = await pool.connect();

    const conditions = ["a.status = 'published'"];
    const values: unknown[] = [];
    let idx = 1;

    if (grade && Number.isInteger(grade)) {
      conditions.push(`c.grade = $${idx++}`);
      values.push(grade);
    }
    if (chapterCode) {
      conditions.push(`c.chapter_code = $${idx++}`);
      values.push(chapterCode);
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
              (SELECT COUNT(*)::int
                 FROM questions q
                WHERE q.activity_id = a.id AND q.role = 'coach_step') AS coach_step_count
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY a.sort_order, a.id`,
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
      };
    });

    return NextResponse.json(
      {
        items,
        total: items.length,
        chapter: items[0]
          ? { code: items[0].chapter_code, title: items[0].chapter_title, grade: items[0].grade }
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
