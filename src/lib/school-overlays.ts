/** Shared SQL / helpers for school catalog overlays (read-time curation). */

import { AI_PROGRAM_SLUG, CT_PROGRAM_SLUG, type ProgramTrack } from "@/lib/subjects";

export type SchoolPreferences = {
  programs_ct_enabled: boolean;
  programs_ai_enabled: boolean;
  default_program_track: ProgramTrack;
  metadata: Record<string, unknown>;
};

export const DEFAULT_SCHOOL_PREFERENCES: SchoolPreferences = {
  programs_ct_enabled: true,
  programs_ai_enabled: true,
  default_program_track: "ct",
  metadata: {},
};

/** Ensure a preferences row exists; return current prefs. */
export async function ensureSchoolPreferences(
  client: { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  schoolId: number,
): Promise<SchoolPreferences> {
  await client.query(
    `INSERT INTO school_preferences (school_id)
     VALUES ($1)
     ON CONFLICT (school_id) DO NOTHING`,
    [schoolId],
  );
  const result = await client.query(
    `SELECT programs_ct_enabled, programs_ai_enabled, default_program_track, metadata
       FROM school_preferences
      WHERE school_id = $1`,
    [schoolId],
  );
  const row = result.rows[0];
  if (!row) return { ...DEFAULT_SCHOOL_PREFERENCES };
  return {
    programs_ct_enabled: row.programs_ct_enabled !== false,
    programs_ai_enabled: row.programs_ai_enabled !== false,
    default_program_track: row.default_program_track === "ai" ? "ai" : "ct",
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

/**
 * Activity is visible for a school when subject, chapter, and activity overlays
 * are enabled (missing overlay = enabled).
 */
export function schoolActivityVisibleSql(
  schoolIdParam: string,
  activityAlias = "a",
  chapterAlias = "c",
  subjectAlias = "s",
): string {
  return `(
    COALESCE((
      SELECT sss.is_enabled FROM school_subject_settings sss
       WHERE sss.school_id = ${schoolIdParam} AND sss.subject_id = ${subjectAlias}.id
    ), TRUE) = TRUE
    AND COALESCE((
      SELECT schs.is_enabled FROM school_chapter_settings schs
       WHERE schs.school_id = ${schoolIdParam} AND schs.chapter_id = ${chapterAlias}.id
    ), TRUE) = TRUE
    AND COALESCE((
      SELECT scs.is_enabled FROM school_content_settings scs
       WHERE scs.school_id = ${schoolIdParam} AND scs.activity_id = ${activityAlias}.id
    ), TRUE) = TRUE
  )`;
}

export function schoolSubjectEnabledSql(schoolIdParam: string, subjectAlias = "s"): string {
  return `COALESCE((
    SELECT sss.is_enabled FROM school_subject_settings sss
     WHERE sss.school_id = ${schoolIdParam} AND sss.subject_id = ${subjectAlias}.id
  ), TRUE) = TRUE`;
}

export function schoolChapterEnabledSql(schoolIdParam: string, chapterAlias = "c"): string {
  return `COALESCE((
    SELECT schs.is_enabled FROM school_chapter_settings schs
     WHERE schs.school_id = ${schoolIdParam} AND schs.chapter_id = ${chapterAlias}.id
  ), TRUE) = TRUE`;
}

export function schoolActivitySortSql(schoolIdParam: string, activityAlias = "a"): string {
  return `COALESCE((
    SELECT scs.sort_override FROM school_content_settings scs
     WHERE scs.school_id = ${schoolIdParam} AND scs.activity_id = ${activityAlias}.id
  ), ${activityAlias}.sort_order)`;
}

export function schoolChapterSortSql(schoolIdParam: string, chapterAlias = "c"): string {
  return `COALESCE((
    SELECT schs.sort_override FROM school_chapter_settings schs
     WHERE schs.school_id = ${schoolIdParam} AND schs.chapter_id = ${chapterAlias}.id
  ), ${chapterAlias}.id)`;
}

export function schoolSubjectSortSql(schoolIdParam: string, subjectAlias = "s"): string {
  return `COALESCE((
    SELECT sss.sort_override FROM school_subject_settings sss
     WHERE sss.school_id = ${schoolIdParam} AND sss.subject_id = ${subjectAlias}.id
  ), ${subjectAlias}.id)`;
}

/** Program prefs may hide CT/AI root subjects even if subject settings say enabled. */
export function subjectAllowedByProgramPrefs(
  slug: string,
  prefs: Pick<SchoolPreferences, "programs_ct_enabled" | "programs_ai_enabled">,
): boolean {
  if (slug === CT_PROGRAM_SLUG) return prefs.programs_ct_enabled;
  if (slug === AI_PROGRAM_SLUG) return prefs.programs_ai_enabled;
  // CBSE anchors are part of the CT lesson-anchored path
  return prefs.programs_ct_enabled;
}
