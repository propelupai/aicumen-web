export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "write");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `UPDATE sections s
          SET is_active = FALSE, updated_at = NOW()
         FROM classes c
        WHERE s.id = $1
          AND s.class_id = c.id
          AND c.school_id = $2
        RETURNING s.id`,
      [sectionId, schoolId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error deleting section");
  } finally {
    if (client) client.release();
  }
}
