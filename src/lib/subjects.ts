/** Subject taxonomy — CBSE lesson anchors vs CT / AI program tracks. */

export const CT_PROGRAM_SLUG = "ct";
export const AI_PROGRAM_SLUG = "ai";

export const CBSE_ANCHOR_SLUGS = [
  "maths",
  "english",
  "science",
  "social_studies",
] as const;

export type CbseAnchorSlug = (typeof CBSE_ANCHOR_SLUGS)[number];

export type SubjectKind = "cbse_anchor" | "ct_program" | "ai_program";

export type ProgramTrack = "ct" | "ai";

/** Grades that offer both CT and AI (CBSE middle-stage AI literacy). */
export function gradeSupportsAiTrack(grade: number | null | undefined): boolean {
  return grade != null && grade >= 6 && grade <= 8;
}

export function subjectKindFromSlug(slug: string): SubjectKind {
  if (slug === CT_PROGRAM_SLUG) return "ct_program";
  if (slug === AI_PROGRAM_SLUG) return "ai_program";
  return "cbse_anchor";
}

export function isProgramSubjectSlug(slug: string): boolean {
  return slug === CT_PROGRAM_SLUG || slug === AI_PROGRAM_SLUG;
}

export function isCbseAnchorSlug(slug: string): slug is CbseAnchorSlug {
  return (CBSE_ANCHOR_SLUGS as readonly string[]).includes(slug);
}
