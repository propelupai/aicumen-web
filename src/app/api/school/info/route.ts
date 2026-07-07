export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

/** School metadata for admins (signup code for inviting staff). */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "user", "invite");

    client = await pool.connect();
    const result = await client.query(
      `SELECT id, name, signup_code FROM schools WHERE id = $1 AND is_active = TRUE`,
      [schoolId],
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ message: "School not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching school info");
  } finally {
    if (client) client.release();
  }
}
