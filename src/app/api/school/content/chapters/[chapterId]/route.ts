export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ chapterId: string }> };

/** Upsert school chapter overlay. Only provided fields are updated. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "content", "curate");

    const { chapterId: chapterIdParam } = await context.params;
    const chapterId = parseInt(chapterIdParam, 10);
    if (!Number.isInteger(chapterId)) {
      return NextResponse.json({ message: "Invalid chapter id" }, { status: 400 });
    }

    const body = await request.json();
    const hasEnabled = typeof body?.is_enabled === "boolean";
    const hasSort = body?.sort_override !== undefined;
    if (!hasEnabled && !hasSort) {
      return NextResponse.json(
        { message: "Provide is_enabled and/or sort_override" },
        { status: 400 },
      );
    }

    client = await pool.connect();

    const exists = await client.query(`SELECT id FROM chapters WHERE id = $1`, [chapterId]);
    if (exists.rows.length === 0) {
      return NextResponse.json({ message: "Chapter not found" }, { status: 404 });
    }

    const result = await client.query(
      `INSERT INTO school_chapter_settings (school_id, chapter_id, is_enabled, sort_override)
       VALUES ($1, $2, COALESCE($3, TRUE), $4)
       ON CONFLICT (school_id, chapter_id)
       DO UPDATE SET
         is_enabled = CASE WHEN $3::boolean IS NULL
           THEN school_chapter_settings.is_enabled ELSE $3 END,
         sort_override = CASE WHEN $5::boolean
           THEN $4 ELSE school_chapter_settings.sort_override END,
         updated_at = NOW()
       RETURNING *`,
      [
        schoolId,
        chapterId,
        hasEnabled ? body.is_enabled : null,
        hasSort ? body.sort_override : null,
        hasSort,
      ],
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating school chapter setting");
  } finally {
    if (client) client.release();
  }
}
