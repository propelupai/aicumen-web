export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount } from "@/lib/rbac";

const MESSAGE_MAX = 4000;

/** Store-only school feedback (no email/PoC routing yet). */
export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    const body = await request.json();
    const message = String(body?.message ?? "").trim();
    const pagePath =
      body?.page_path != null ? String(body.page_path).trim().slice(0, 500) : null;

    if (!message) {
      return NextResponse.json({ message: "Feedback message is required" }, { status: 400 });
    }
    if (message.length > MESSAGE_MAX) {
      return NextResponse.json(
        { message: `Feedback must be ${MESSAGE_MAX} characters or fewer` },
        { status: 400 },
      );
    }

    client = await pool.connect();
    const { rows } = await client.query(
      `INSERT INTO school_feedback (school_id, user_id, message, page_path)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [schoolId, auth.user_id, message, pagePath],
    );

    return NextResponse.json(
      { id: rows[0].id, created_at: rows[0].created_at, ok: true },
      { status: 201 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error saving feedback");
  } finally {
    if (client) client.release();
  }
}
