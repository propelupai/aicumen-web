export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";

export async function GET(request: NextRequest) {
  let client;
  try {
    // Throws (mapped to 401 below) if the cookie is missing/invalid.
    const base = await getAuthUser(request);

    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT u.user_id, u.role, u.school_id, u.display_name, u.photo_url,
              COALESCE(u.account_type, 'teacher') AS account_type,
              u.platform_role,
              us.role_key AS school_role_key,
              s.name AS school_name
         FROM users u
         LEFT JOIN schools s ON s.id = u.school_id
         LEFT JOIN user_schools us
           ON us.user_id = u.user_id AND us.school_id = u.school_id
        WHERE u.user_id = $1
          AND u.is_active = TRUE`,
      [base.user_id],
    );
    if (rows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const res = NextResponse.json(
      { ...rows[0], firebase_uid: base.firebase_uid ?? null },
      { status: 200 },
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("unauth")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting current user:", message);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
