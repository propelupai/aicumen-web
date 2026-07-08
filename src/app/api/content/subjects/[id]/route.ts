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
    const subjectId = parseInt(id, 10);
    if (!Number.isInteger(subjectId)) {
      return NextResponse.json({ message: "Invalid subject id" }, { status: 400 });
    }

    const body = await request.json();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body?.name != null) {
      fields.push(`name = $${idx++}`);
      values.push(String(body.name).trim());
    }
    if (body?.grade_min != null) {
      fields.push(`grade_min = $${idx++}`);
      values.push(parseInt(String(body.grade_min), 10));
    }
    if (body?.grade_max != null) {
      fields.push(`grade_max = $${idx++}`);
      values.push(parseInt(String(body.grade_max), 10));
    }

    if (fields.length === 0) {
      return NextResponse.json({ message: "No fields to update" }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(subjectId);

    client = await pool.connect();
    const result = await client.query(
      `UPDATE subjects SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Subject not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating subject");
  } finally {
    if (client) client.release();
  }
}
