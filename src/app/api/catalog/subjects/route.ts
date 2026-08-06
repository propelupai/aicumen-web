export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount } from "@/lib/rbac";
import {
  AI_PROGRAM_SLUG,
  CT_PROGRAM_SLUG,
  type ProgramTrack,
} from "@/lib/subjects";
import {
  ensureSchoolPreferences,
  schoolActivityVisibleSql,
  schoolSubjectEnabledSql,
  schoolSubjectSortSql,
  subjectAllowedByProgramPrefs,
} from "@/lib/school-overlays";

/**
 * Catalog subjects for the teacher live-class picker.
 * - track=ct (default): CBSE lesson anchors only (excludes ct + ai program subjects)
 * - track=ai: Artificial Intelligence program subject only
 * Respects school overlays + program preferences.
 */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    const trackParam = request.nextUrl.searchParams.get("track");
    const track: ProgramTrack = trackParam === "ai" ? "ai" : "ct";

    client = await pool.connect();
    const prefs = await ensureSchoolPreferences(client, schoolId);

    if (track === "ai" && !prefs.programs_ai_enabled) {
      return NextResponse.json([], { status: 200 });
    }
    if (track === "ct" && !prefs.programs_ct_enabled) {
      return NextResponse.json([], { status: 200 });
    }

    const schoolParam = "$1";
    const visible = schoolActivityVisibleSql(schoolParam, "a", "c", "s");
    const subjectEnabled = schoolSubjectEnabledSql(schoolParam, "s");
    const subjectSort = schoolSubjectSortSql(schoolParam, "s");

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
                       WHERE c.subject_id = s.id
                         AND a.status = 'published'
                         AND ${visible}
                    ) AS has_published_quests
               FROM subjects s
              WHERE s.slug = $2
                AND ${subjectEnabled}
              ORDER BY ${subjectSort}, s.name`,
            [schoolId, AI_PROGRAM_SLUG],
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
                       WHERE c.subject_id = s.id
                         AND a.status = 'published'
                         AND ${visible}
                    ) AS has_published_quests
               FROM subjects s
              WHERE s.slug NOT IN ($2, $3)
                AND ${subjectEnabled}
              ORDER BY ${subjectSort}, s.name`,
            [schoolId, CT_PROGRAM_SLUG, AI_PROGRAM_SLUG],
          );

    const rows = result.rows.filter((s) =>
      subjectAllowedByProgramPrefs(s.slug, prefs),
    );

    return NextResponse.json(rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching catalog subjects");
  } finally {
    if (client) client.release();
  }
}
