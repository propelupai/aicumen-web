export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";

const DISPLAY_NAME_MAX = 80;

type SchoolMembership = {
  id: number;
  name: string;
  role_key: string;
  joined_at: string;
  is_active: boolean;
};

async function fetchSchoolMemberships(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: SchoolMembership[] }> },
  userId: string,
  activeSchoolId: number | null,
) {
  const { rows } = await client.query(
    `SELECT s.id,
            s.name,
            us.role_key,
            us.joined_at,
            (s.id = $2) AS is_active
       FROM user_schools us
       JOIN schools s ON s.id = us.school_id
      WHERE us.user_id = $1
        AND s.is_active = TRUE
      ORDER BY (s.id = $2) DESC, s.name`,
    [userId, activeSchoolId],
  );
  return rows;
}

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT u.user_id,
              u.email,
              u.display_name,
              u.photo_url,
              u.username,
              u.school_id,
              u.created_at,
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
      [auth.user_id],
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const schools = await fetchSchoolMemberships(client, auth.user_id, rows[0].school_id);

    const res = NextResponse.json({ ...rows[0], schools }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error loading profile");
  } finally {
    if (client) client.release();
  }
}

export async function PATCH(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    const body = await request.json();
    const displayName = String(body?.display_name ?? "").trim();

    if (!displayName) {
      return NextResponse.json({ message: "Display name is required" }, { status: 400 });
    }
    if (displayName.length > DISPLAY_NAME_MAX) {
      return NextResponse.json(
        { message: `Display name must be ${DISPLAY_NAME_MAX} characters or fewer` },
        { status: 400 },
      );
    }

    client = await pool.connect();
    const { rows } = await client.query(
      `UPDATE users
          SET display_name = $1,
              updated_at = NOW()
        WHERE user_id = $2
          AND is_active = TRUE
        RETURNING user_id, email, display_name, photo_url, username, school_id, created_at,
                  COALESCE(account_type, 'teacher') AS account_type,
                  platform_role`,
      [displayName, auth.user_id],
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const schoolRole = await client.query(
      `SELECT us.role_key AS school_role_key, s.name AS school_name
         FROM users u
         LEFT JOIN user_schools us
           ON us.user_id = u.user_id AND us.school_id = u.school_id
         LEFT JOIN schools s ON s.id = u.school_id
        WHERE u.user_id = $1`,
      [auth.user_id],
    );

    const schools = await fetchSchoolMemberships(client, auth.user_id, rows[0].school_id);

    return NextResponse.json(
      { ...rows[0], ...schoolRole.rows[0], schools },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating profile");
  } finally {
    if (client) client.release();
  }
}
