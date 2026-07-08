export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    const body = await request.json();
    const activityId = parseInt(String(body?.activity_id ?? ""), 10);
    const role = String(body?.role ?? "stem").trim();
    const stem = String(body?.stem ?? "").trim();

    if (!Number.isInteger(activityId) || !stem) {
      return NextResponse.json({ message: "activity_id and stem are required" }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO questions
         (activity_id, parent_question_id, role, sort_order, label, stem, context,
          hint, delivery, answer_spec, teacher_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        activityId,
        body?.parent_question_id ?? null,
        role,
        body?.sort_order ?? 0,
        body?.label ?? null,
        stem,
        body?.context ?? {},
        body?.hint ?? null,
        body?.delivery ?? null,
        body?.answer_spec ?? null,
        body?.teacher_notes ?? null,
      ],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating question");
  } finally {
    if (client) client.release();
  }
}
