export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    client = await pool.connect();
    const result = await client.query(
      `SELECT s.id, s.name, us.role_key,
              (s.id = $2) AS is_active
         FROM user_schools us
         JOIN schools s ON s.id = us.school_id
        WHERE us.user_id = $1 AND s.is_active = TRUE
        ORDER BY s.name`,
      [auth.user_id, auth.school_id],
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching schools");
  } finally {
    if (client) client.release();
  }
}
