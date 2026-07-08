export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool, poolQuery } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

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
    requirePermission(auth, "content", "curate");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    if (!(await assertSectionInSchool(sectionId, schoolId))) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    client = await pool.connect();
    const result = await client.query(
      `SELECT st.section_id,
              st.track_id,
              st.assigned_at,
              t.label,
              t.track_type,
              t.subject_id,
              t.grade,
              t.ct_level
         FROM section_tracks st
         JOIN curriculum_tracks t ON t.id = st.track_id
        WHERE st.section_id = $1`,
      [sectionId],
    );

    return NextResponse.json(result.rows[0] ?? null, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching section track");
  } finally {
    if (client) client.release();
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "content", "curate");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    if (!(await assertSectionInSchool(sectionId, schoolId))) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    const body = await request.json();
    const trackId = parseInt(String(body?.track_id ?? ""), 10);
    if (!Number.isInteger(trackId)) {
      return NextResponse.json({ message: "track_id is required" }, { status: 400 });
    }

    client = await pool.connect();

    const trackExists = await client.query(
      `SELECT id FROM curriculum_tracks WHERE id = $1 AND is_active = TRUE`,
      [trackId],
    );
    if (trackExists.rows.length === 0) {
      return NextResponse.json({ message: "Track not found" }, { status: 404 });
    }

    const result = await client.query(
      `INSERT INTO section_tracks (section_id, track_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (section_id)
       DO UPDATE SET track_id = EXCLUDED.track_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
       RETURNING *`,
      [sectionId, trackId, auth.user_id],
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error assigning section track");
  } finally {
    if (client) client.release();
  }
}
