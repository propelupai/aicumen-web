export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    client = await pool.connect();
    const result = await client.query(
      `SELECT t.*, s.name AS subject_name
         FROM curriculum_tracks t
         LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE t.is_active = TRUE
        ORDER BY t.track_type, t.grade NULLS LAST, t.ct_level NULLS LAST, t.label`,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching tracks");
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    const body = await request.json();
    const trackType = String(body?.track_type ?? "").trim();
    const label = String(body?.label ?? "").trim();

    if (!label || !["grade_subject", "ct_level"].includes(trackType)) {
      return NextResponse.json({ message: "track_type and label are required" }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO curriculum_tracks
         (track_type, subject_id, grade, ct_level, label, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [
        trackType,
        body?.subject_id ?? null,
        body?.grade ?? null,
        body?.ct_level ?? null,
        label,
      ],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating track");
  } finally {
    if (client) client.release();
  }
}
