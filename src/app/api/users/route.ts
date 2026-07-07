export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-error";

/** Count staff (non-student) members — first staff signup becomes school_admin. */
async function schoolStaffCount(
  client: import("pg").PoolClient,
  schoolId: number,
): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM user_schools us
       JOIN users u ON u.user_id = us.user_id
      WHERE us.school_id = $1
        AND u.is_active = TRUE
        AND u.account_type = 'teacher'
        AND us.role_key IN ('teacher', 'school_admin')`,
    [schoolId],
  );
  return result.rows[0]?.count ?? 0;
}

/**
 * Signup pre-seed. Validates the sign-up code against `schools`, then creates
 * (or joins) a `users` row and `user_schools` membership WITHOUT firebase_uid yet.
 */
export async function POST(request: NextRequest) {
  let client;
  try {
    const { email: rawEmail, display_name, signup_code } = await request.json();

    if (!rawEmail || !display_name || !signup_code) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const email = String(rawEmail).trim().toLowerCase();
    const code = String(signup_code).trim();

    client = await pool.connect();

    const schoolResult = await client.query(
      "SELECT id, name FROM schools WHERE signup_code = $1 AND is_active = TRUE",
      [code],
    );
    if (schoolResult.rows.length === 0) {
      return NextResponse.json({ message: "Invalid or expired signup code" }, { status: 400 });
    }
    const school_id: number = schoolResult.rows[0].id;
    const staffCount = await schoolStaffCount(client, school_id);
    const role_key = staffCount === 0 ? "school_admin" : "teacher";

    const existingUser = await client.query(
      "SELECT user_id, email, display_name, school_id FROM users WHERE email = $1 AND is_active = TRUE",
      [email],
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      await client.query(
        `INSERT INTO user_schools (user_id, school_id, role_key)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, school_id) DO UPDATE
           SET role_key = CASE
             WHEN $3 = 'school_admin' THEN EXCLUDED.role_key
             ELSE user_schools.role_key
           END`,
        [user.user_id, school_id, role_key],
      );
      await client.query(
        `UPDATE users SET school_id = $1, account_type = 'teacher', updated_at = NOW()
          WHERE user_id = $2`,
        [school_id, user.user_id],
      );
      return NextResponse.json(
        { ...user, school_id, role_key, joined_existing: true },
        { status: 200 },
      );
    }

    const result = await client.query(
      `INSERT INTO users (
         email, display_name, school_id, is_active, role,
         account_type, created_at, updated_at
       )
       VALUES ($1, $2, $3, TRUE, 'member', 'teacher', NOW(), NOW())
       RETURNING user_id, email, display_name, school_id, created_at`,
      [email, display_name, school_id],
    );

    const user = result.rows[0];
    await client.query(
      `INSERT INTO user_schools (user_id, school_id, role_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, school_id) DO NOTHING`,
      [user.user_id, school_id, role_key],
    );

    return NextResponse.json({ ...user, role_key }, { status: 201 });
  } catch (error: unknown) {
    return apiErrorResponse(error, "Error creating user");
  } finally {
    if (client) client.release();
  }
}
