export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    client = await pool.connect();
    const result = await client.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM chapters c WHERE c.subject_id = s.id) AS chapter_count
         FROM subjects s
        ORDER BY s.name`,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching subjects");
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    const body = await request.json();
    const slug = String(body?.slug ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();
    const gradeMin = parseInt(String(body?.grade_min ?? 3), 10);
    const gradeMax = parseInt(String(body?.grade_max ?? 8), 10);

    if (!slug || !name) {
      return NextResponse.json({ message: "Slug and name are required" }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO subjects (slug, name, grade_min, grade_max)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [slug, name, gradeMin, gradeMax],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating subject");
  } finally {
    if (client) client.release();
  }
}
