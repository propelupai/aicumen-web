export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "roster", "manage");

    const { userId } = await context.params;
    const body = await request.json();

    client = await pool.connect();

    const existing = await client.query(
      `SELECT user_id FROM users
        WHERE user_id = $1 AND school_id = $2 AND account_type = 'student' AND is_active = TRUE`,
      [userId, schoolId],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    if (body?.is_active === false) {
      await client.query("BEGIN");
      await client.query(
        `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1`,
        [userId],
      );
      await client.query(
        `UPDATE student_enrollments
            SET status = 'withdrawn', withdrawn_at = NOW()
          WHERE user_id = $1 AND status = 'active'`,
        [userId],
      );
      await client.query("COMMIT");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const displayName = body?.display_name ? String(body.display_name).trim() : null;
    const username = body?.username !== undefined
      ? (body.username ? String(body.username).trim().toLowerCase() : null)
      : undefined;

    if (displayName || username !== undefined) {
      await client.query(
        `UPDATE users
            SET display_name = COALESCE($1, display_name),
                username = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE username END,
                updated_at = NOW()
          WHERE user_id = $3`,
        [displayName, username ?? null, userId],
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return apiErrorResponse(err, "Error updating student");
  } finally {
    if (client) client.release();
  }
}
