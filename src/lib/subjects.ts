/** Subject taxonomy — CBSE lesson anchors vs CT program track. */

export const CT_PROGRAM_SLUG = "ct";

export const CBSE_ANCHOR_SLUGS = [
  "maths",
  "english",
  "science",
  "social_studies",
] as const;

export type CbseAnchorSlug = (typeof CBSE_ANCHOR_SLUGS)[number];

export type SubjectKind = "cbse_anchor" | "ct_program";

export function subjectKindFromSlug(slug: string): SubjectKind {
  return slug === CT_PROGRAM_SLUG ? "ct_program" : "cbse_anchor";
}

export function isCbseAnchorSlug(slug: string): slug is CbseAnchorSlug {
  return (CBSE_ANCHOR_SLUGS as readonly string[]).includes(slug);
}
