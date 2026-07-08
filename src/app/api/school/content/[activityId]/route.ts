export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ activityId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "content", "curate");

    const { activityId: activityIdParam } = await context.params;
    const activityId = parseInt(activityIdParam, 10);
    if (!Number.isInteger(activityId)) {
      return NextResponse.json({ message: "Invalid activity id" }, { status: 400 });
    }

    const body = await request.json();

    client = await pool.connect();

    const exists = await client.query(
      `SELECT id FROM activities WHERE id = $1 AND status = 'published'`,
      [activityId],
    );
    if (exists.rows.length === 0) {
      return NextResponse.json({ message: "Activity not found" }, { status: 404 });
    }

    const result = await client.query(
      `INSERT INTO school_content_settings (school_id, activity_id, is_enabled, sort_override)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (school_id, activity_id)
       DO UPDATE SET
         is_enabled = COALESCE(EXCLUDED.is_enabled, school_content_settings.is_enabled),
         sort_override = COALESCE(EXCLUDED.sort_override, school_content_settings.sort_override),
         updated_at = NOW()
       RETURNING *`,
      [
        schoolId,
        activityId,
        body?.is_enabled ?? true,
        body?.sort_override ?? null,
      ],
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating school content setting");
  } finally {
    if (client) client.release();
  }
}
