export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool, poolQuery } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import {
  assertActiveSchool,
  assertTeacherAccount,
  type AuthLike,
  hasPermission,
  requirePermission,
} from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = new Set(["not_started", "in_progress", "completed", "skipped"]);

function requireSessionOrCurate(auth: AuthLike): void {
  if (!hasPermission(auth, "session", "run") && !hasPermission(auth, "content", "curate")) {
    requirePermission(auth, "session", "run");
  }
}

async function assertSectionInSchool(sectionId: number, schoolId: number): Promise<boolean> {
  const { rows } = await poolQuery<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM sections s
       JOIN classes c ON c.id = s.class_id
      WHERE s.id = $1 AND c.school_id = $2`,
    [sectionId, schoolId],
  );
  return rows.length > 0;
}

export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requireSessionOrCurate(auth);

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    if (!(await assertSectionInSchool(sectionId, schoolId))) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    client = await pool.connect();

    const trackRow = await client.query(
      `SELECT st.track_id, t.track_type, t.subject_id, t.grade, t.ct_level
         FROM section_tracks st
         JOIN curriculum_tracks t ON t.id = st.track_id
        WHERE st.section_id = $1`,
      [sectionId],
    );

    const track = trackRow.rows[0];
    if (!track) {
      return NextResponse.json(
        { section_id: sectionId, track: null, activities: [], summary: { total: 0, completed: 0 } },
        { status: 200 },
      );
    }

    const conditions = ["a.status = 'published'"];
    const values: unknown[] = [schoolId, sectionId];
    let idx = 3;

    if (track.track_type === "grade_subject") {
      if (track.subject_id) {
        conditions.push(`c.subject_id = $${idx++}`);
        values.push(track.subject_id);
      }
      if (track.grade) {
        conditions.push(`c.grade = $${idx++}`);
        values.push(track.grade);
      }
    }

    const activities = await client.query(
      `SELECT a.id,
              a.title,
              a.slug,
              c.chapter_code,
              c.title AS chapter_title,
              COALESCE(scs.is_enabled, TRUE) AS is_enabled,
              COALESCE(p.status, 'not_started') AS progress_status,
              p.completed_at,
              p.notes
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         LEFT JOIN school_content_settings scs
           ON scs.activity_id = a.id AND scs.school_id = $1
         LEFT JOIN section_activity_progress p
           ON p.activity_id = a.id AND p.section_id = $2
        WHERE ${conditions.join(" AND ")}
        ORDER BY a.sort_order, a.id`,
      values,
    );

    const enabled = activities.rows.filter((r) => r.is_enabled !== false);
    const completed = enabled.filter((r) => r.progress_status === "completed").length;

    return NextResponse.json(
      {
        section_id: sectionId,
        track,
        activities: activities.rows,
        summary: { total: enabled.length, completed },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching section progress");
  } finally {
    if (client) client.release();
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requireSessionOrCurate(auth);

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    if (!(await assertSectionInSchool(sectionId, schoolId))) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    const body = await request.json();
    const activityId = parseInt(String(body?.activity_id ?? ""), 10);
    const status = String(body?.status ?? "").trim();

    if (!Number.isInteger(activityId) || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ message: "activity_id and valid status are required" }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO section_activity_progress
         (section_id, activity_id, status, completed_at, updated_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (section_id, activity_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = EXCLUDED.completed_at,
         updated_by = EXCLUDED.updated_by,
         notes = COALESCE(EXCLUDED.notes, section_activity_progress.notes),
         updated_at = NOW()
       RETURNING *`,
      [
        sectionId,
        activityId,
        status,
        status === "completed" ? new Date().toISOString() : null,
        auth.user_id,
        body?.notes ?? null,
      ],
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating section progress");
  } finally {
    if (client) client.release();
  }
}
