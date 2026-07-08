export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";

/** Subjects that have at least one published quest (for live class picker). */
export async function GET(request: Request) {
  let client;
  try {
    const auth = await getAuthUser(request as import("next/server").NextRequest);
    assertTeacherAccount(auth);

    client = await pool.connect();
    const result = await client.query(
      `SELECT DISTINCT s.id, s.slug, s.name, s.grade_min, s.grade_max
         FROM subjects s
         JOIN chapters c ON c.subject_id = s.id
         JOIN activities a ON a.chapter_id = c.id
        WHERE a.status = 'published'
        ORDER BY s.name`,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching catalog subjects");
  } finally {
    if (client) client.release();
  }
}
