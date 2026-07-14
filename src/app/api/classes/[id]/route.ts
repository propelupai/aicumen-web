export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

async function getClassForSchool(
  client: import("pg").PoolClient,
  classId: number,
  schoolId: number,
): Promise<{ id: number; grade: number; name: string | null } | null> {
  const r = await client.query<{ id: number; grade: number; name: string | null }>(
    `SELECT id, grade, name FROM classes WHERE id = $1 AND school_id = $2`,
    [classId, schoolId],
  );
  return r.rows[0] ?? null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "write");

    const { id } = await context.params;
    const classId = parseInt(id, 10);
    if (!Number.isInteger(classId)) {
      return NextResponse.json({ message: "Invalid class id" }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ message: "name is required" }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json(
        { message: "name must be 80 characters or fewer" },
        { status: 400 },
      );
    }

    client = await pool.connect();
    const existing = await getClassForSchool(client, classId, schoolId);
    if (!existing) {
      return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }

    const result = await client.query(
      `UPDATE classes
          SET name = $1, updated_at = NOW()
        WHERE id = $2 AND school_id = $3
        RETURNING id, academic_year_id, grade, name, is_active`,
      [name, classId, schoolId],
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating class");
  } finally {
    if (client) client.release();
  }
}

/** Delete a class — only allowed when it has no sections (active or archived). */
export async function DELETE(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "write");

    const { id } = await context.params;
    const classId = parseInt(id, 10);
    if (!Number.isInteger(classId)) {
      return NextResponse.json({ message: "Invalid class id" }, { status: 400 });
    }

    client = await pool.connect();
    const existing = await getClassForSchool(client, classId, schoolId);
    if (!existing) {
      return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }

    const sectionCount = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM sections WHERE class_id = $1 AND is_active = TRUE`,
      [classId],
    );
    if ((sectionCount.rows[0]?.count ?? 0) > 0) {
      return NextResponse.json(
        { message: "Remove all sections before deleting this class." },
        { status: 409 },
      );
    }

    await client.query(`DELETE FROM classes WHERE id = $1 AND school_id = $2`, [
      classId,
      schoolId,
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error deleting class");
  } finally {
    if (client) client.release();
  }
}
