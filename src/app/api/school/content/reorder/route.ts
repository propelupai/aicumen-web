export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type Scope = "subjects" | "chapters" | "activities";

/**
 * Batch reorder within a parent list.
 * Body: { scope: "subjects"|"chapters"|"activities", ordered_ids: number[] }
 * Writes dense sort_override 10,20,30… for the school.
 */
export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "content", "curate");

    const body = await request.json();
    const scope = body?.scope as Scope;
    const orderedIds = Array.isArray(body?.ordered_ids)
      ? body.ordered_ids.map((id: unknown) => parseInt(String(id), 10)).filter((n: number) => Number.isInteger(n))
      : [];

    if (!["subjects", "chapters", "activities"].includes(scope)) {
      return NextResponse.json({ message: "Invalid scope" }, { status: 400 });
    }
    if (orderedIds.length === 0) {
      return NextResponse.json({ message: "ordered_ids required" }, { status: 400 });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const sort = (i + 1) * 10;

        if (scope === "subjects") {
          await client.query(
            `INSERT INTO school_subject_settings (school_id, subject_id, is_enabled, sort_override)
             VALUES ($1, $2, TRUE, $3)
             ON CONFLICT (school_id, subject_id)
             DO UPDATE SET sort_override = $3, updated_at = NOW()`,
            [schoolId, id, sort],
          );
        } else if (scope === "chapters") {
          await client.query(
            `INSERT INTO school_chapter_settings (school_id, chapter_id, is_enabled, sort_override)
             VALUES ($1, $2, TRUE, $3)
             ON CONFLICT (school_id, chapter_id)
             DO UPDATE SET sort_override = $3, updated_at = NOW()`,
            [schoolId, id, sort],
          );
        } else {
          await client.query(
            `INSERT INTO school_content_settings (school_id, activity_id, is_enabled, sort_override)
             VALUES ($1, $2, TRUE, $3)
             ON CONFLICT (school_id, activity_id)
             DO UPDATE SET sort_override = $3, updated_at = NOW()`,
            [schoolId, id, sort],
          );
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    return NextResponse.json({ ok: true, scope, count: orderedIds.length }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error reordering school catalog");
  } finally {
    if (client) client.release();
  }
}
