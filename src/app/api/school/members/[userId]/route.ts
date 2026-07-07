export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool, poolQuery } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import {
  assertActiveSchool,
  assertTeacherAccount,
  ASSIGNABLE_STAFF_ROLES,
  requirePermission,
  type SchoolRoleKey,
} from "@/lib/rbac";

type RouteContext = { params: Promise<{ userId: string }> };

async function wouldRemoveLastAdmin(
  userId: string,
  schoolId: number,
  newRole: SchoolRoleKey,
): Promise<boolean> {
  if (newRole === "school_admin") return false;
  const { rows } = await poolQuery<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM user_schools us
       JOIN users u ON u.user_id = us.user_id
      WHERE us.school_id = $1
        AND us.role_key = 'school_admin'
        AND u.is_active = TRUE
        AND us.user_id <> $2`,
    [schoolId, userId],
  );
  return (rows[0]?.count ?? 0) === 0;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "user", "assign_role");

    const { userId } = await context.params;
    const body = await request.json();
    const roleKey = String(body?.role_key ?? "").trim() as SchoolRoleKey;

    if (!ASSIGNABLE_STAFF_ROLES.includes(roleKey)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    if (userId === auth.user_id && roleKey !== "school_admin") {
      if (await wouldRemoveLastAdmin(auth.user_id, schoolId, roleKey)) {
        return NextResponse.json(
          { message: "You cannot remove the last school admin. Assign another admin first." },
          { status: 400 },
        );
      }
    }

    client = await pool.connect();

    const target = await client.query(
      `SELECT us.role_key
         FROM user_schools us
         JOIN users u ON u.user_id = us.user_id
        WHERE us.user_id = $1
          AND us.school_id = $2
          AND u.account_type = 'teacher'
          AND u.is_active = TRUE`,
      [userId, schoolId],
    );
    if (target.rows.length === 0) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 });
    }

    if (target.rows[0].role_key === "school_admin" && roleKey !== "school_admin") {
      const adminCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM user_schools us
           JOIN users u ON u.user_id = us.user_id
          WHERE us.school_id = $1
            AND us.role_key = 'school_admin'
            AND u.is_active = TRUE`,
        [schoolId],
      );
      if ((adminCount.rows[0]?.count ?? 0) <= 1) {
        return NextResponse.json(
          { message: "At least one school admin is required." },
          { status: 400 },
        );
      }
    }

    await client.query(
      `UPDATE user_schools SET role_key = $1 WHERE user_id = $2 AND school_id = $3`,
      [roleKey, userId, schoolId],
    );

    return NextResponse.json({ ok: true, role_key: roleKey }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error updating member role");
  } finally {
    if (client) client.release();
  }
}
