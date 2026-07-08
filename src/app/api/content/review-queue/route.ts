export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";

/** Draft and review activities awaiting platform admin approval. */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    client = await pool.connect();
    const result = await client.query(
      `SELECT a.id,
              a.slug,
              a.title,
              a.status,
              a.activity_type,
              a.updated_at,
              c.chapter_code,
              c.title AS chapter_title,
              c.grade,
              s.name AS subject_name,
              (SELECT COUNT(*)::int FROM questions q WHERE q.activity_id = a.id) AS question_count
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
        WHERE a.status IN ('draft', 'review')
        ORDER BY a.updated_at DESC, a.id DESC`,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching review queue");
  } finally {
    if (client) client.release();
  }
}
