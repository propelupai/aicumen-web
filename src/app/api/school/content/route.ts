export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";
import {
  ensureSchoolPreferences,
  schoolChapterSortSql,
  schoolSubjectSortSql,
} from "@/lib/school-overlays";
import { AI_PROGRAM_SLUG, CT_PROGRAM_SLUG, subjectKindFromSlug } from "@/lib/subjects";

type ActivityNode = {
  id: number;
  slug: string;
  title: string;
  sort_order: number;
  estimated_minutes: number;
  metadata: unknown;
  is_enabled: boolean;
  sort_override: number | null;
  effective_sort: number;
};

type ChapterNode = {
  id: number;
  chapter_code: string;
  title: string;
  grade: number;
  is_enabled: boolean;
  sort_override: number | null;
  effective_sort: number;
  activity_count: number;
  enabled_activity_count: number;
  activities: ActivityNode[];
};

type SubjectNode = {
  id: number;
  slug: string;
  name: string;
  kind: string;
  grade_min: number;
  grade_max: number;
  is_enabled: boolean;
  sort_override: number | null;
  effective_sort: number;
  chapter_count: number;
  enabled_chapter_count: number;
  chapters: ChapterNode[];
};

/** Hierarchical school catalog + prefs for curation UI (also returns flat activities for legacy tabs). */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "content", "curate");

    const gradeParam = request.nextUrl.searchParams.get("grade");
    const grade = gradeParam ? parseInt(gradeParam, 10) : null;

    client = await pool.connect();
    const preferences = await ensureSchoolPreferences(client, schoolId);

    const subjectOrder = schoolSubjectSortSql("$1", "s");
    const chapterOrder = schoolChapterSortSql("$1", "c");

    const subjectsResult = await client.query(
      `SELECT s.id, s.slug, s.name, s.grade_min, s.grade_max,
              COALESCE(s.kind, 'cbse_anchor') AS kind,
              COALESCE(sss.is_enabled, TRUE) AS is_enabled,
              sss.sort_override,
              ${subjectOrder} AS effective_sort
         FROM subjects s
         LEFT JOIN school_subject_settings sss
           ON sss.subject_id = s.id AND sss.school_id = $1
        ORDER BY ${subjectOrder}, s.name`,
      [schoolId],
    );

    const chapterConditions = ["TRUE"];
    const chapterValues: unknown[] = [schoolId];
    let cIdx = 2;
    if (grade && Number.isInteger(grade)) {
      chapterConditions.push(`c.grade = $${cIdx++}`);
      chapterValues.push(grade);
    }

    const chaptersResult = await client.query(
      `SELECT c.id, c.subject_id, c.chapter_code, c.title, c.grade,
              COALESCE(schs.is_enabled, TRUE) AS is_enabled,
              schs.sort_override,
              ${chapterOrder} AS effective_sort
         FROM chapters c
         LEFT JOIN school_chapter_settings schs
           ON schs.chapter_id = c.id AND schs.school_id = $1
        WHERE ${chapterConditions.join(" AND ")}
        ORDER BY c.subject_id, ${chapterOrder}, c.chapter_code`,
      chapterValues,
    );

    const activityConditions = ["a.status = 'published'"];
    const activityValues: unknown[] = [schoolId];
    let aIdx = 2;
    if (grade && Number.isInteger(grade)) {
      activityConditions.push(`c.grade = $${aIdx++}`);
      activityValues.push(grade);
    }

    const activitiesResult = await client.query(
      `SELECT a.id, a.slug, a.title, a.sort_order, a.estimated_minutes, a.ct_skills, a.metadata,
              a.chapter_id,
              c.grade, c.chapter_code, c.title AS chapter_title,
              s.id AS subject_id, s.name AS subject_name, s.slug AS subject_slug,
              COALESCE(scs.is_enabled, TRUE) AS is_enabled,
              scs.sort_override,
              COALESCE(scs.sort_override, a.sort_order) AS effective_sort
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
         LEFT JOIN school_content_settings scs
           ON scs.activity_id = a.id AND scs.school_id = $1
        WHERE ${activityConditions.join(" AND ")}
        ORDER BY a.chapter_id, COALESCE(scs.sort_override, a.sort_order), a.id`,
      activityValues,
    );

    const activitiesByChapter = new Map<number, ActivityNode[]>();
    for (const row of activitiesResult.rows) {
      const list = activitiesByChapter.get(row.chapter_id) ?? [];
      list.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        sort_order: row.sort_order,
        estimated_minutes: row.estimated_minutes,
        metadata: row.metadata,
        is_enabled: row.is_enabled !== false,
        sort_override: row.sort_override ?? null,
        effective_sort: row.effective_sort,
      });
      activitiesByChapter.set(row.chapter_id, list);
    }

    const chaptersBySubject = new Map<number, ChapterNode[]>();
    for (const row of chaptersResult.rows) {
      const acts = activitiesByChapter.get(row.id) ?? [];
      const node: ChapterNode = {
        id: row.id,
        chapter_code: row.chapter_code,
        title: row.title,
        grade: row.grade,
        is_enabled: row.is_enabled !== false,
        sort_override: row.sort_override ?? null,
        effective_sort: row.effective_sort,
        activity_count: acts.length,
        enabled_activity_count: acts.filter((a) => a.is_enabled).length,
        activities: acts,
      };
      const list = chaptersBySubject.get(row.subject_id) ?? [];
      list.push(node);
      chaptersBySubject.set(row.subject_id, list);
    }

    const tree: SubjectNode[] = subjectsResult.rows
      .filter((s) => {
        // Hide CT program bank from school customize UI (lesson subjects + AI only).
        if (s.slug === CT_PROGRAM_SLUG) return false;
        // When grade filter is on, only keep subjects that have chapters in that grade
        // or the AI program subject.
        const chapters = chaptersBySubject.get(s.id) ?? [];
        if (grade && Number.isInteger(grade)) {
          return chapters.length > 0 || s.slug === AI_PROGRAM_SLUG;
        }
        return true;
      })
      .map((s) => {
        const chapters = chaptersBySubject.get(s.id) ?? [];
        return {
          id: s.id,
          slug: s.slug,
          name: s.name,
          kind: s.kind ?? subjectKindFromSlug(s.slug),
          grade_min: s.grade_min,
          grade_max: s.grade_max,
          is_enabled: s.is_enabled !== false,
          sort_override: s.sort_override ?? null,
          effective_sort: s.effective_sort,
          chapter_count: chapters.length,
          enabled_chapter_count: chapters.filter((c) => c.is_enabled).length,
          chapters,
        };
      });

    const tracks = await client.query(
      `SELECT t.*, s.name AS subject_name
         FROM curriculum_tracks t
         LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE t.is_active = TRUE
        ORDER BY t.label`,
    );

    const sections = await client.query(
      `SELECT sec.id,
              sec.display_name,
              sec.section_label,
              c.grade,
              st.track_id,
              t.label AS track_label
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         LEFT JOIN section_tracks st ON st.section_id = sec.id
         LEFT JOIN curriculum_tracks t ON t.id = st.track_id
        WHERE c.school_id = $1
          AND sec.is_active = TRUE
          AND ay.is_current = TRUE
        ORDER BY c.grade, sec.display_name`,
      [schoolId],
    );

    return NextResponse.json(
      {
        preferences,
        tree,
        activities: activitiesResult.rows,
        tracks: tracks.rows,
        sections: sections.rows,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching school content");
  } finally {
    if (client) client.release();
  }
}
