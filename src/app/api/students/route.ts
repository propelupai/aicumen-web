export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "roster", "manage");

    client = await pool.connect();
    const result = await client.query(
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

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching students");
  } finally {
    if (client) client.release();
  }
}

/** Add a student to the school roster pool (no Firebase account yet). */
export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "roster", "manage");

    const body = await request.json();
    const displayName = String(body?.display_name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const username = body?.username ? String(body.username).trim().toLowerCase() : null;

    if (!displayName) {
      return NextResponse.json({ message: "display_name is required" }, { status: 400 });
    }
    if (!email && !username) {
      return NextResponse.json(
        { message: "Either email or username is required" },
        { status: 400 },
      );
    }

    client = await pool.connect();

    if (email) {
      const dup = await client.query(
        `SELECT user_id FROM users WHERE email = $1 AND is_active = TRUE`,
        [email],
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ message: "A user with this email already exists." }, { status: 400 });
      }
    }
    if (username) {
      const dup = await client.query(
        `SELECT user_id FROM users WHERE LOWER(username) = $1 AND is_active = TRUE`,
        [username],
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ message: "This username is already taken." }, { status: 400 });
      }
    }

    const placeholderEmail = email || `${username}@students.local`;

    const result = await client.query(
      `INSERT INTO users (
         email, display_name, username, school_id, account_type, is_active, role, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, 'student', TRUE, 'member', NOW(), NOW())
       RETURNING user_id, display_name, email, username`,
      [placeholderEmail, displayName, username, schoolId],
    );

    const student = result.rows[0];
    await client.query(
      `INSERT INTO user_schools (user_id, school_id, role_key)
       VALUES ($1, $2, 'student')
       ON CONFLICT (user_id, school_id) DO NOTHING`,
      [student.user_id, schoolId],
    );

    return NextResponse.json(student, { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error creating student");
  } finally {
    if (client) client.release();
  }
}
