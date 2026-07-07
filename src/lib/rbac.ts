import { poolQuery } from "@/lib/db";

export type SchoolRoleKey = "teacher" | "school_admin" | "student";
export type AccountType = "teacher" | "student";

const ROLE_PERMISSIONS: Record<SchoolRoleKey | "platform_admin", string[]> = {
  teacher: [
    "content:read",
    "session:run",
    "journal:write",
    "school_structure:read",
    "school_structure:write",
  ],
  school_admin: [
    "content:read",
    "session:run",
    "journal:write",
    "school_structure:read",
    "school_structure:write",
    "roster:manage",
    "user:invite",
    "user:assign_role",
    "school:admin",
  ],
  student: ["content:read", "quest:run"],
  platform_admin: ["platform:*"],
};

export type AuthLike = {
  user_id: string;
  school_id: number | null;
  account_type?: AccountType | null;
  platform_role?: string | null;
  school_role_key?: SchoolRoleKey | null;
};

function normalizeSchoolRole(role: string | null | undefined): SchoolRoleKey | null {
  if (role === "teacher" || role === "school_admin" || role === "student") return role;
  // Legacy rows may still carry "member"; treat it as teacher permissions.
  if (role === "member") return "teacher";
  return null;
}

export function assertTeacherAccount(auth: AuthLike): void {
  if (auth.account_type === "student") {
    throw new Error("Forbidden: teacher account required");
  }
}

export function assertActiveSchool(auth: AuthLike): number {
  if (!auth.school_id) {
    throw new Error("Forbidden: no active school selected");
  }
  return auth.school_id;
}

function effectiveRoleKey(auth: AuthLike): SchoolRoleKey | "platform_admin" {
  if (auth.platform_role === "platform_admin") return "platform_admin";
  return normalizeSchoolRole(auth.school_role_key) ?? "teacher";
}

export function hasPermission(auth: AuthLike, resource: string, action: string): boolean {
  const role = effectiveRoleKey(auth);
  const perms = ROLE_PERMISSIONS[role] ?? [];
  const key = `${resource}:${action}`;
  if (perms.includes("platform:*")) return true;
  return perms.includes(key);
}

export function requirePermission(auth: AuthLike, resource: string, action: string): void {
  if (!hasPermission(auth, resource, action)) {
    throw new Error(`Forbidden: missing ${action} on ${resource}`);
  }
}

/** Load school_role_key for the active school if not already on auth. */
export async function hydrateSchoolRole(auth: AuthLike): Promise<AuthLike> {
  if (auth.school_role_key || !auth.school_id) return auth;
  const { rows } = await poolQuery<{ role_key: SchoolRoleKey }>(
    `SELECT role_key FROM user_schools WHERE user_id = $1 AND school_id = $2`,
    [auth.user_id, auth.school_id],
  );
  return {
    ...auth,
    school_role_key: normalizeSchoolRole(rows[0]?.role_key ?? null) ?? "teacher",
  };
}
