export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";
import { CT_PROGRAM_SLUG } from "@/lib/subjects";

/**
 * CBSE lesson subjects for the live-class anchor picker (Maths, English, …).
 * Excludes the CT program track — teachers pick what they taught in class, not "CT".
 */
export async function GET(request: Request) {
  let client;
  try {
    const auth = await getAuthUser(request as import("next/server").NextRequest);
    assertTeacherAccount(auth);

    client = await pool.connect();
    const result = await client.query(
      `SELECT s.id,
              s.slug,
              s.name,
              s.grade_min,
              s.grade_max,
              'cbse_anchor' AS kind,
              EXISTS (
                SELECT 1
                  FROM chapters c
                  JOIN activities a ON a.chapter_id = c.id
                 WHERE c.subject_id = s.id AND a.status = 'published'
              ) AS has_published_quests
         FROM subjects s
        WHERE s.slug <> $1
        ORDER BY s.name`,
      [CT_PROGRAM_SLUG],
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching catalog subjects");
  } finally {
    if (client) client.release();
  }
}
