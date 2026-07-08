export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = new Set(["draft", "review", "published"]);

export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    const { id } = await context.params;
    const activityId = parseInt(id, 10);
    if (!Number.isInteger(activityId)) {
      return NextResponse.json({ message: "Invalid activity id" }, { status: 400 });
    }

    client = await pool.connect();

    const actResult = await client.query(
      `SELECT a.*,
              c.chapter_code,
              c.title AS chapter_title,
              c.grade,
              s.name AS subject_name
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
        WHERE a.id = $1`,
      [activityId],
    );

    if (actResult.rows.length === 0) {
      return NextResponse.json({ message: "Activity not found" }, { status: 404 });
    }

    const qResult = await client.query(
      `SELECT id, role, sort_order, label, stem, hint, context, delivery,
              answer_spec, teacher_notes
         FROM questions
        WHERE activity_id = $1
        ORDER BY sort_order, id`,
      [activityId],
    );

    return NextResponse.json(
      { ...actResult.rows[0], questions: qResult.rows },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching activity");
  } finally {
    if (client) client.release();
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    const { id } = await context.params;
    const activityId = parseInt(id, 10);
    if (!Number.isInteger(activityId)) {
      return NextResponse.json({ message: "Invalid activity id" }, { status: 400 });
    }

    const body = await request.json();

    if (body?.status != null && !ALLOWED_STATUSES.has(String(body.status))) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowed = [
      "title",
      "slug",
      "activity_type",
      "source_type_label",
      "sort_order",
      "estimated_minutes",
      "ct_skills",
      "ai_concept",
      "status",
      "metadata",
    ] as const;

    for (const key of allowed) {
      if (body?.[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ message: "No fields to update" }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(activityId);

    client = await pool.connect();
    const result = await client.query(
      `UPDATE activities SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Activity not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating activity");
  } finally {
    if (client) client.release();
  }
}
