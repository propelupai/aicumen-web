export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

async function verifyYearBelongsToSchool(
  client: import("pg").PoolClient,
  yearId: number,
  schoolId: number,
): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM academic_years WHERE id = $1 AND school_id = $2`,
    [yearId, schoolId],
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

    const yearParam = request.nextUrl.searchParams.get("academic_year_id");
    const yearId = yearParam ? parseInt(yearParam, 10) : null;

    client = await pool.connect();

    if (yearId) {
      if (!(await verifyYearBelongsToSchool(client, yearId, schoolId))) {
        return NextResponse.json({ message: "Academic year not found" }, { status: 404 });
      }
      const result = await client.query(
        `SELECT c.id, c.grade, c.name, c.is_active,
                COUNT(s.id)::int AS section_count
           FROM classes c
           LEFT JOIN sections s ON s.class_id = c.id AND s.is_active = TRUE
          WHERE c.school_id = $1 AND c.academic_year_id = $2
          GROUP BY c.id
          ORDER BY c.grade`,
        [schoolId, yearId],
      );
      return NextResponse.json(result.rows, { status: 200 });
    }

    const result = await client.query(
      `SELECT c.id, c.academic_year_id, c.grade, c.name, c.is_active
         FROM classes c
        WHERE c.school_id = $1
        ORDER BY c.grade`,
      [schoolId],
    );
    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching classes");
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
    const academicYearId = parseInt(String(body?.academic_year_id ?? ""), 10);
    const grade = parseInt(String(body?.grade ?? ""), 10);
    if (!Number.isInteger(academicYearId) || !Number.isInteger(grade)) {
      return NextResponse.json(
        { message: "academic_year_id and grade are required" },
        { status: 400 },
      );
    }

    client = await pool.connect();
    if (!(await verifyYearBelongsToSchool(client, academicYearId, schoolId))) {
      return NextResponse.json({ message: "Academic year not found" }, { status: 404 });
    }

    const name = body?.name ? String(body.name).trim() : `Class ${grade}`;
    const result = await client.query(
      `INSERT INTO classes (school_id, academic_year_id, grade, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (school_id, academic_year_id, grade) DO UPDATE
         SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id, academic_year_id, grade, name, is_active`,
      [schoolId, academicYearId, grade, name],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating class");
  } finally {
    if (client) client.release();
  }
}
