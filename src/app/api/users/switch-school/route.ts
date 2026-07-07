export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    const body = await request.json();
    const schoolId = parseInt(String(body?.school_id ?? ""), 10);
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      return NextResponse.json({ message: "school_id is required" }, { status: 400 });
    }

    if (schoolId === auth.school_id) {
      return NextResponse.json({ ok: true, school_id: schoolId }, { status: 200 });
    }

    client = await pool.connect();
    const membership = await client.query(
      `SELECT 1 FROM user_schools WHERE user_id = $1 AND school_id = $2`,
      [auth.user_id, schoolId],
    );
    if (membership.rows.length === 0) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await client.query(
      `UPDATE users SET school_id = $1, updated_at = NOW() WHERE user_id = $2`,
      [schoolId, auth.user_id],
    );

    return NextResponse.json({ ok: true, school_id: schoolId }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error switching school");
  } finally {
    if (client) client.release();
  }
}
