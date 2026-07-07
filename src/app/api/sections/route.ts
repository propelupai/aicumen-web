export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

async function verifyClassBelongsToSchool(
  client: import("pg").PoolClient,
  classId: number,
  schoolId: number,
): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM classes WHERE id = $1 AND school_id = $2`,
    [classId, schoolId],
  );
  return r.rows.length > 0;
}

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "read");

    const classId = parseInt(request.nextUrl.searchParams.get("class_id") ?? "", 10);
    if (!Number.isInteger(classId)) {
      return NextResponse.json({ message: "class_id is required" }, { status: 400 });
    }

    client = await pool.connect();
    if (!(await verifyClassBelongsToSchool(client, classId, schoolId))) {
      return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }

    const result = await client.query(
      `SELECT id, class_id, section_label, display_name, is_active, created_at
         FROM sections
        WHERE class_id = $1 AND is_active = TRUE
        ORDER BY section_label`,
      [classId],
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching sections");
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "write");

    const body = await request.json();
    const classId = parseInt(String(body?.class_id ?? ""), 10);
    const sectionLabel = String(body?.section_label ?? "").trim().toUpperCase();
    if (!Number.isInteger(classId) || !sectionLabel) {
      return NextResponse.json(
        { message: "class_id and section_label are required" },
        { status: 400 },
      );
    }

    client = await pool.connect();
    if (!(await verifyClassBelongsToSchool(client, classId, schoolId))) {
      return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }

    const classRow = await client.query<{ grade: number }>(
      `SELECT grade FROM classes WHERE id = $1`,
      [classId],
    );
    const grade = classRow.rows[0]?.grade;
    const displayName =
      String(body?.display_name ?? "").trim() || `${grade}-${sectionLabel}`;

    const result = await client.query(
      `INSERT INTO sections (class_id, section_label, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, section_label) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             is_active = TRUE,
             updated_at = NOW()
       RETURNING id, class_id, section_label, display_name, is_active`,
      [classId, sectionLabel, displayName],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating section");
  } finally {
    if (client) client.release();
  }
}
