export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "read");

    client = await pool.connect();
    const result = await client.query(
      `SELECT id, label, starts_on, ends_on, is_current, created_at
         FROM academic_years
        WHERE school_id = $1
        ORDER BY is_current DESC, label DESC`,
      [schoolId],
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching academic years");
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
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ message: "label is required" }, { status: 400 });
    }
    const setCurrent = body?.is_current !== false;

    client = await pool.connect();
    await client.query("BEGIN");

    if (setCurrent) {
      await client.query(
        `UPDATE academic_years SET is_current = FALSE, updated_at = NOW()
          WHERE school_id = $1`,
        [schoolId],
      );
    }

    const result = await client.query(
      `INSERT INTO academic_years (school_id, label, is_current, starts_on, ends_on)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (school_id, label) DO UPDATE
         SET is_current = EXCLUDED.is_current, updated_at = NOW()
       RETURNING id, label, starts_on, ends_on, is_current, created_at`,
      [schoolId, label, setCurrent, body?.starts_on ?? null, body?.ends_on ?? null],
    );

    await client.query("COMMIT");
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return apiErrorResponse(err, "Error creating academic year");
  } finally {
    if (client) client.release();
  }
}
