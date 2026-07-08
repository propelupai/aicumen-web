export type ProfileRoleContext = {
  platform_role?: string | null;
  school_role_key?: string | null;
  account_type?: string | null;
};

export function formatSchoolRoleLabel(roleKey?: string | null): string {
  if (roleKey === "school_admin") return "School admin";
  if (roleKey === "teacher") return "Teacher";
  if (roleKey === "student") return "Student";
  return "Member";
}

export function formatUserRoleLabel(ctx: ProfileRoleContext): string {
  if (ctx.platform_role === "platform_admin") return "Platform admin";
  return formatSchoolRoleLabel(ctx.school_role_key);
}

export function formatAccountTypeLabel(accountType?: string | null): string {
  if (accountType === "student") return "Student account";
  return "Teacher account";
}
