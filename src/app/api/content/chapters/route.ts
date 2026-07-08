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

    const subjectId = request.nextUrl.searchParams.get("subject_id");
    const grade = request.nextUrl.searchParams.get("grade");

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (subjectId) {
      conditions.push(`c.subject_id = $${idx++}`);
      values.push(parseInt(subjectId, 10));
    }
    if (grade) {
      conditions.push(`c.grade = $${idx++}`);
      values.push(parseInt(grade, 10));
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    client = await pool.connect();
    const result = await client.query(
      `SELECT c.*,
              s.name AS subject_name,
              (SELECT COUNT(*)::int FROM activities a WHERE a.chapter_id = c.id) AS activity_count
         FROM chapters c
         JOIN subjects s ON s.id = c.subject_id
        ${where}
        ORDER BY c.grade, c.chapter_code`,
      values,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching chapters");
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
    const subjectId = parseInt(String(body?.subject_id ?? ""), 10);
    const grade = parseInt(String(body?.grade ?? ""), 10);
    const chapterCode = String(body?.chapter_code ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const anchorCurriculum = body?.anchor_curriculum ?? null;
    const anchorReference = body?.anchor_reference ?? null;

    if (!Number.isInteger(subjectId) || !Number.isInteger(grade) || !chapterCode || !title) {
      return NextResponse.json(
        { message: "subject_id, grade, chapter_code, and title are required" },
        { status: 400 },
      );
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO chapters
         (subject_id, grade, chapter_code, title, anchor_curriculum, anchor_reference)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [subjectId, grade, chapterCode, title, anchorCurriculum, anchorReference],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating chapter");
  } finally {
    if (client) client.release();
  }
}
