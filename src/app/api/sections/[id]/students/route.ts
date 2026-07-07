export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

type StudentRow = {
  user_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  active_section_id: number | null;
  active_section_name: string | null;
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
      WHERE s.id = $1
        AND s.is_active = TRUE
        AND c.school_id = $2`,
    [sectionId, schoolId],
  );
  return meta.rows[0] ?? null;
}

async function getSchoolStudents(
  client: import("pg").PoolClient,
  schoolId: number,
): Promise<StudentRow[]> {
  const students = await client.query<StudentRow>(
    `SELECT u.user_id,
            u.display_name,
            u.email,
            u.username,
            se.section_id AS active_section_id,
            ss.section_display_name AS active_section_name
       FROM users u
       LEFT JOIN student_enrollments se
         ON se.user_id = u.user_id AND se.status = 'active'
       LEFT JOIN section_schools ss
         ON ss.section_id = se.section_id
      WHERE u.school_id = $1
        AND u.account_type = 'student'
        AND u.is_active = TRUE
      ORDER BY COALESCE(NULLIF(TRIM(u.display_name), ''), u.email)`,
    [schoolId],
  );
  return students.rows;
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

    const students = await getSchoolStudents(client, schoolId);
    return NextResponse.json(
      {
        section,
        students: students.map((s) => ({
          ...s,
          assigned_to_this_section: s.active_section_id === sectionId,
        })),
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching section students");
  } finally {
    if (client) client.release();
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
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
    const rawIds: unknown[] | null = Array.isArray(body?.student_user_ids)
      ? body.student_user_ids
      : null;
    if (!rawIds) {
      return NextResponse.json({ message: "student_user_ids is required" }, { status: 400 });
    }
    const selectedIds: string[] = Array.from(
      new Set(rawIds.map((v: unknown) => String(v).trim()).filter((v): v is string => Boolean(v))),
    );

    client = await pool.connect();
    const section = await getSectionMeta(client, sectionId, schoolId);
    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    const allowedStudents = await client.query<{ user_id: string }>(
      `SELECT user_id
         FROM users
        WHERE school_id = $1
          AND account_type = 'student'
          AND is_active = TRUE`,
      [schoolId],
    );
    const allowedSet = new Set(allowedStudents.rows.map((r) => r.user_id));
    const invalid = selectedIds.filter((idVal) => !allowedSet.has(idVal));
    if (invalid.length > 0) {
      return NextResponse.json(
        { message: "One or more students do not belong to this school." },
        { status: 400 },
      );
    }

    await client.query("BEGIN");

    await client.query(
      `UPDATE student_enrollments
          SET status = 'transferred',
              withdrawn_at = NOW()
        WHERE section_id = $1
          AND status = 'active'
          AND NOT (user_id = ANY($2::uuid[]))`,
      [sectionId, selectedIds],
    );

    if (selectedIds.length > 0) {
      await client.query(
        `UPDATE student_enrollments
            SET status = 'transferred',
                withdrawn_at = NOW()
          WHERE user_id = ANY($1::uuid[])
            AND status = 'active'
            AND section_id <> $2`,
        [selectedIds, sectionId],
      );

      await client.query(
        `INSERT INTO student_enrollments (user_id, section_id, status, enrolled_at, withdrawn_at)
         SELECT idv, $2, 'active', NOW(), NULL
           FROM unnest($1::uuid[]) AS idv
         ON CONFLICT (user_id, section_id) DO UPDATE
           SET status = 'active',
               withdrawn_at = NULL,
               enrolled_at = NOW()`,
        [selectedIds, sectionId],
      );
    }

    await client.query("COMMIT");

    const students = await getSchoolStudents(client, schoolId);
    return NextResponse.json(
      {
        section,
        students: students.map((s) => ({
          ...s,
          assigned_to_this_section: s.active_section_id === sectionId,
        })),
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return apiErrorResponse(err, "Error updating section students");
  } finally {
    if (client) client.release();
  }
}
