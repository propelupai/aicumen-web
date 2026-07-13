export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";

/**
 * CBSE handbook mandates for filtering content by compliance item.
 * Grade-scoped (codes like M1 are specific to a grade). Optional `grade` filter.
 */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    const gradeParam = request.nextUrl.searchParams.get("grade");
    const grade = gradeParam ? parseInt(gradeParam, 10) : null;

    const conditions: string[] = [];
    const values: unknown[] = [];
    if (grade && Number.isInteger(grade)) {
      conditions.push(`m.grade = $1`);
      values.push(grade);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    client = await pool.connect();
    const result = await client.query(
      `SELECT m.grade,
              m.code,
              m.handbook_item,
              m.unit,
              m.handbook_track,
              (SELECT COUNT(DISTINCT acm.activity_id)::int
                 FROM activity_cbse_mandates acm
                WHERE acm.mandate_grade = m.grade
                  AND acm.mandate_code = m.code) AS activity_count
         FROM cbse_mandates m
         ${where}
        ORDER BY m.grade, m.sort_order, m.code`,
      values,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching CBSE mandates");
  } finally {
    if (client) client.release();
  }
}
