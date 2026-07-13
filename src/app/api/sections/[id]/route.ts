export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

/** Edit a section's label and/or display name. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "write");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    const body = await request.json();
    const hasLabel = body?.section_label !== undefined;
    const hasDisplay = body?.display_name !== undefined;
    const sectionLabel = hasLabel
      ? String(body.section_label ?? "").trim().toUpperCase()
      : null;
    const displayName = hasDisplay ? String(body.display_name ?? "").trim() : null;

    if (!hasLabel && !hasDisplay) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }
    if (hasLabel && !sectionLabel) {
      return NextResponse.json({ message: "section_label cannot be empty" }, { status: 400 });
    }
    if (hasDisplay && !displayName) {
      return NextResponse.json({ message: "display_name cannot be empty" }, { status: 400 });
    }

    client = await pool.connect();

    const owned = await client.query<{ id: number }>(
      `SELECT s.id
         FROM sections s
         JOIN classes c ON c.id = s.class_id
        WHERE s.id = $1 AND c.school_id = $2 AND s.is_active = TRUE`,
      [sectionId, schoolId],
    );
    if (owned.rows.length === 0) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    try {
      const result = await client.query(
        `UPDATE sections
            SET section_label = COALESCE($1, section_label),
                display_name = COALESCE($2, display_name),
                updated_at = NOW()
          WHERE id = $3
          RETURNING id, class_id, section_label, display_name, is_active`,
        [sectionLabel, displayName, sectionId],
      );
      return NextResponse.json(result.rows[0], { status: 200 });
    } catch (dbErr: unknown) {
      if ((dbErr as { code?: string })?.code === "23505") {
        return NextResponse.json(
          { message: "A section with that label already exists in this class." },
          { status: 409 },
        );
      }
      throw dbErr;
    }
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating section");
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "write");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `UPDATE sections s
          SET is_active = FALSE, updated_at = NOW()
         FROM classes c
        WHERE s.id = $1
          AND s.class_id = c.id
          AND c.school_id = $2
        RETURNING s.id`,
      [sectionId, schoolId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error deleting section");
  } finally {
    if (client) client.release();
  }
}
