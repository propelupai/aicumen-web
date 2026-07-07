export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * Signup pre-seed. Validates the sign-up code against `schools`, then creates
 * (or re-homes) a `users` row for that school WITHOUT a firebase_uid yet. The
 * Firebase account is created client-side right after; `/api/auth/sync` then
 * stitches the firebase_uid onto this row by matching email.
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
      "SELECT id, name FROM schools WHERE signup_code = $1",
      [code],
    );
    if (schoolResult.rows.length === 0) {
      return NextResponse.json({ message: "Invalid or expired signup code" }, { status: 400 });
    }
    const school_id: number = schoolResult.rows[0].id;

    // Existing active user: move them to this school (idempotent re-signup).
    const existingUser = await client.query(
      "SELECT user_id, email, display_name, school_id FROM users WHERE email = $1 AND is_active = TRUE",
      [email],
    );
    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      await client.query(
        `UPDATE users SET school_id = $1, updated_at = NOW() WHERE user_id = $2`,
        [school_id, user.user_id],
      );
      return NextResponse.json({ ...user, school_id, joined_existing: true }, { status: 200 });
    }

    const result = await client.query(
      `INSERT INTO users (email, display_name, school_id, is_active, role, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, 'member', NOW(), NOW())
       RETURNING user_id, email, display_name, school_id, created_at`,
      [email, display_name, school_id],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating user:", message);
    return NextResponse.json({ message: `Internal server error: ${message}` }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
