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

    const chapterId = request.nextUrl.searchParams.get("chapter_id");
    const status = request.nextUrl.searchParams.get("status");

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (chapterId) {
      conditions.push(`a.chapter_id = $${idx++}`);
      values.push(parseInt(chapterId, 10));
    }
    if (status) {
      conditions.push(`a.status = $${idx++}`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    client = await pool.connect();
    const result = await client.query(
      `SELECT a.*,
              c.chapter_code,
              c.title AS chapter_title,
              c.grade,
              s.name AS subject_name,
              (SELECT COUNT(*)::int FROM questions q WHERE q.activity_id = a.id) AS question_count
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
        ${where}
        ORDER BY c.grade, c.chapter_code, a.sort_order, a.id`,
      values,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching activities");
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
    const chapterId = parseInt(String(body?.chapter_id ?? ""), 10);
    const slug = String(body?.slug ?? "").trim();
    const title = String(body?.title ?? "").trim();

    if (!Number.isInteger(chapterId) || !slug || !title) {
      return NextResponse.json(
        { message: "chapter_id, slug, and title are required" },
        { status: 400 },
      );
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO activities
         (chapter_id, slug, title, activity_type, source_type_label, sort_order,
          estimated_minutes, ct_skills, ai_concept, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        chapterId,
        slug,
        title,
        body?.activity_type ?? "quest",
        body?.source_type_label ?? null,
        body?.sort_order ?? 0,
        body?.estimated_minutes ?? 15,
        body?.ct_skills ?? [],
        body?.ai_concept ?? null,
        body?.status ?? "draft",
        body?.metadata ?? {},
      ],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating activity");
  } finally {
    if (client) client.release();
  }
}
