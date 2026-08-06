/** Shared labels for academic year create UI (Setup). */
export const ACADEMIC_YEAR_OPTIONS = ["2025-26", "2026-27", "2027-28", "2028-29"] as const;

export type AcademicYearOption = (typeof ACADEMIC_YEAR_OPTIONS)[number];

export type SchoolPartnerFields = {
  partner_label: string | null;
  welcome_blurb: string | null;
  poc_name: string | null;
  poc_email: string | null;
  poc_title: string | null;
};

export function hasPartnerBadge(school: { partner_label?: string | null }): boolean {
  return !!(school.partner_label && school.partner_label.trim());
}

export function hasDedicatedPoc(school: {
  poc_name?: string | null;
  poc_email?: string | null;
}): boolean {
  return !!(school.poc_name?.trim() && school.poc_email?.trim());
}
