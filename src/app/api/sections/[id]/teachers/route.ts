export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

type TeacherRow = {
  user_id: string;
  display_name: string | null;
  email: string;
  photo_url: string | null;
  role_key: string;
  is_assigned: boolean;
  is_primary: boolean;
};

async function getSectionMeta(
  client: import("pg").PoolClient,
  sectionId: number,
  schoolId: number,
): Promise<{ section_id: number; display_name: string; class_name: string } | null> {
  const meta = await client.query<{
    section_id: number;
    display_name: string;
    class_name: string;
  }>(
    `SELECT s.id AS section_id, s.display_name, c.name AS class_name
       FROM sections s
       JOIN classes c ON c.id = s.class_id
      WHERE s.id = $1 AND s.is_active = TRUE AND c.school_id = $2`,
    [sectionId, schoolId],
  );
  return meta.rows[0] ?? null;
}

async function getTeachers(
  client: import("pg").PoolClient,
  sectionId: number,
  schoolId: number,
): Promise<TeacherRow[]> {
  const result = await client.query<TeacherRow>(
    `SELECT u.user_id,
            u.display_name,
            u.email,
            u.photo_url,
            us.role_key,
            (cta.user_id IS NOT NULL) AS is_assigned,
            COALESCE(cta.is_primary, FALSE) AS is_primary
       FROM user_schools us
       JOIN users u ON u.user_id = us.user_id
       LEFT JOIN class_teacher_assignments cta
         ON cta.user_id = u.user_id AND cta.section_id = $2
      WHERE us.school_id = $1
        AND u.account_type = 'teacher'
        AND u.is_active = TRUE
        AND us.role_key IN ('teacher', 'school_admin')
      ORDER BY (cta.user_id IS NOT NULL) DESC,
               COALESCE(NULLIF(TRIM(u.display_name), ''), u.email)`,
    [schoolId, sectionId],
  );
  return result.rows;
}

export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "school_structure", "read");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    client = await pool.connect();
    const section = await getSectionMeta(client, sectionId, schoolId);
    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    const teachers = await getTeachers(client, sectionId, schoolId);
    return NextResponse.json({ section, teachers }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching section teachers");
  } finally {
    if (client) client.release();
  }
}

/** Replace the teacher assignments for a section. Requires roster:manage (school admin). */
export async function PUT(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "roster", "manage");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    const body = await request.json();
    const rawIds: unknown[] = Array.isArray(body?.teacher_user_ids)
      ? body.teacher_user_ids
      : [];
    const primaryUserId =
      body?.primary_user_id != null ? String(body.primary_user_id).trim() : null;

    const selectedIds: string[] = Array.from(
      new Set(rawIds.map((v) => String(v).trim()).filter((v): v is string => Boolean(v))),
    );

    if (primaryUserId && !selectedIds.includes(primaryUserId)) {
      return NextResponse.json(
        { message: "Primary teacher must be one of the assigned teachers." },
        { status: 400 },
      );
    }

    client = await pool.connect();
    const section = await getSectionMeta(client, sectionId, schoolId);
    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    if (selectedIds.length > 0) {
      const allowed = await client.query<{ user_id: string }>(
        `SELECT u.user_id
           FROM user_schools us
           JOIN users u ON u.user_id = us.user_id
          WHERE us.school_id = $1
            AND u.account_type = 'teacher'
            AND u.is_active = TRUE
            AND us.role_key IN ('teacher', 'school_admin')
            AND u.user_id = ANY($2::uuid[])`,
        [schoolId, selectedIds],
      );
      const allowedSet = new Set(allowed.rows.map((r) => r.user_id));
      const invalid = selectedIds.filter((v) => !allowedSet.has(v));
      if (invalid.length > 0) {
        return NextResponse.json(
          { message: "One or more teachers do not belong to this school." },
          { status: 400 },
        );
      }
    }

    await client.query("BEGIN");

    await client.query(
      `DELETE FROM class_teacher_assignments
        WHERE section_id = $1
          AND NOT (user_id = ANY($2::uuid[]))`,
      [sectionId, selectedIds],
    );

    if (selectedIds.length > 0) {
      await client.query(
        `INSERT INTO class_teacher_assignments (user_id, section_id, is_primary, assigned_by)
         SELECT idv, $2, COALESCE(idv = $3::uuid, FALSE), $4
           FROM unnest($1::uuid[]) AS idv
         ON CONFLICT (user_id, section_id) DO UPDATE
           SET is_primary = EXCLUDED.is_primary`,
        [selectedIds, sectionId, primaryUserId, auth.user_id],
      );
    }

    await client.query("COMMIT");

    const teachers = await getTeachers(client, sectionId, schoolId);
    return NextResponse.json({ section, teachers }, { status: 200 });
  } catch (err: unknown) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return apiErrorResponse(err, "Error updating section teachers");
  } finally {
    if (client) client.release();
  }
}
