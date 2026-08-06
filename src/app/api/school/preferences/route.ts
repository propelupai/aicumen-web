export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";
import { ensureSchoolPreferences } from "@/lib/school-overlays";
import type { ProgramTrack } from "@/lib/subjects";

/** GET / PATCH school program preferences (CT/AI visibility + default track). */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    client = await pool.connect();
    const preferences = await ensureSchoolPreferences(client, schoolId);
    return NextResponse.json(preferences, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching school preferences");
  } finally {
    if (client) client.release();
  }
}

export async function PATCH(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "content", "curate");

    const body = await request.json();
    const updates: string[] = [];
    const values: unknown[] = [schoolId];
    let idx = 2;

    if (typeof body?.programs_ct_enabled === "boolean") {
      updates.push(`programs_ct_enabled = $${idx++}`);
      values.push(body.programs_ct_enabled);
    }
    if (typeof body?.programs_ai_enabled === "boolean") {
      updates.push(`programs_ai_enabled = $${idx++}`);
      values.push(body.programs_ai_enabled);
    }
    if (body?.default_program_track === "ct" || body?.default_program_track === "ai") {
      updates.push(`default_program_track = $${idx++}`);
      values.push(body.default_program_track as ProgramTrack);
    }
    if (body?.metadata && typeof body.metadata === "object") {
      updates.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(body.metadata));
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No preference fields to update" }, { status: 400 });
    }

    client = await pool.connect();
    await ensureSchoolPreferences(client, schoolId);

    const result = await client.query(
      `UPDATE school_preferences
          SET ${updates.join(", ")}, updated_at = NOW()
        WHERE school_id = $1
        RETURNING programs_ct_enabled, programs_ai_enabled, default_program_track, metadata`,
      values,
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating school preferences");
  } finally {
    if (client) client.release();
  }
}
