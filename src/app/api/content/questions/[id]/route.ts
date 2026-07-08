export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    const { id } = await context.params;
    const questionId = parseInt(id, 10);
    if (!Number.isInteger(questionId)) {
      return NextResponse.json({ message: "Invalid question id" }, { status: 400 });
    }

    const body = await request.json();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowed = [
      "role",
      "sort_order",
      "label",
      "stem",
      "context",
      "hint",
      "delivery",
      "answer_spec",
      "teacher_notes",
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
    values.push(questionId);

    client = await pool.connect();
    const result = await client.query(
      `UPDATE questions SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating question");
  } finally {
    if (client) client.release();
  }
}
