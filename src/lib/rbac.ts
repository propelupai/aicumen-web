import { poolQuery } from "@/lib/db";

export type SchoolRoleKey = "teacher" | "school_admin" | "student";
export type AccountType = "teacher" | "student";

/** Human-readable permission catalog — single source for API + UI. */
export const PERMISSION_LABELS: Record<string, string> = {
  "content:read": "View quest content",
  "session:run": "Run live Socratic sessions",
  "journal:write": "Write observation journal entries",
  "school_structure:read": "View classes, sections, and years",
  "school_structure:write": "Manage classes, sections, and years",
  "roster:manage": "Manage student roster",
  "user:invite": "Invite staff via signup code",
  "user:assign_role": "Change staff roles and access",
  "school:admin": "Full school administration",
  "quest:run": "Complete quests (student)",
  "platform:*": "Platform-wide administration",
};

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

export type RoleDefinition = {
  key: SchoolRoleKey;
  label: string;
  description: string;
  permissions: { key: string; label: string }[];
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "school_admin",
    label: "School admin",
    description:
      "Full control over school setup, staff access, and student roster. Typically the principal or IT lead.",
    permissions: ROLE_PERMISSIONS.school_admin.map((key) => ({
      key,
      label: PERMISSION_LABELS[key] ?? key,
    })),
  },
  {
    key: "teacher",
    label: "Teacher",
    description:
      "Runs AI Periods, manages class structure, and views content. Cannot change other users' roles.",
    permissions: ROLE_PERMISSIONS.teacher.map((key) => ({
      key,
      label: PERMISSION_LABELS[key] ?? key,
    })),
  },
  {
    key: "student",
    label: "Student",
    description: "Accesses assigned quests on a student device. No admin capabilities.",
    permissions: ROLE_PERMISSIONS.student.map((key) => ({
      key,
      label: PERMISSION_LABELS[key] ?? key,
    })),
  },
];

export type AuthLike = {
  user_id: string;
  school_id: number | null;
  account_type?: AccountType | null;
  platform_role?: string | null;
  school_role_key?: SchoolRoleKey | null;
};

function normalizeSchoolRole(role: string | null | undefined): SchoolRoleKey | null {
  if (role === "teacher" || role === "school_admin" || role === "student") return role;
  if (role === "member") return "teacher";
  return null;
}

export function assertTeacherAccount(auth: AuthLike): void {
  if (auth.account_type === "student") {
    throw new Error("Forbidden: teacher account is required");
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

export function canManageAccess(auth: AuthLike): boolean {
  return hasPermission(auth, "user", "assign_role") || hasPermission(auth, "roster", "manage");
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

/** Staff roles assignable by school admins (not student). */
export const ASSIGNABLE_STAFF_ROLES: SchoolRoleKey[] = ["teacher", "school_admin"];
