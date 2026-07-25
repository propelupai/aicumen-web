export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";
import {
  AI_PROGRAM_SLUG,
  CT_PROGRAM_SLUG,
  type ProgramTrack,
} from "@/lib/subjects";

/**
 * Catalog subjects for the teacher live-class picker.
 * - track=ct (default): CBSE lesson anchors only (excludes ct + ai program subjects)
 * - track=ai: Artificial Intelligence program subject only
 */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    const trackParam = request.nextUrl.searchParams.get("track");
    const track: ProgramTrack = trackParam === "ai" ? "ai" : "ct";

    client = await pool.connect();

    const result =
      track === "ai"
        ? await client.query(
            `SELECT s.id,
                    s.slug,
                    s.name,
                    s.grade_min,
                    s.grade_max,
                    s.kind,
                    EXISTS (
                      SELECT 1
                        FROM chapters c
                        JOIN activities a ON a.chapter_id = c.id
                       WHERE c.subject_id = s.id AND a.status = 'published'
                    ) AS has_published_quests
               FROM subjects s
              WHERE s.slug = $1
              ORDER BY s.name`,
            [AI_PROGRAM_SLUG],
          )
        : await client.query(
            `SELECT s.id,
                    s.slug,
                    s.name,
                    s.grade_min,
                    s.grade_max,
                    COALESCE(s.kind, 'cbse_anchor') AS kind,
                    EXISTS (
                      SELECT 1
                        FROM chapters c
                        JOIN activities a ON a.chapter_id = c.id
                       WHERE c.subject_id = s.id AND a.status = 'published'
                    ) AS has_published_quests
               FROM subjects s
              WHERE s.slug NOT IN ($1, $2)
              ORDER BY s.name`,
            [CT_PROGRAM_SLUG, AI_PROGRAM_SLUG],
          );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching catalog subjects");
  } finally {
    if (client) client.release();
  }
}
