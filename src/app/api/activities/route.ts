export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";
import {
  type ActivityListItem,
  type ActivityMandate,
  metadataToListFields,
  parseActivityMetadata,
} from "@/lib/activities";
import { CT_PROGRAM_SLUG } from "@/lib/subjects";
import {
  activityMandateMatchSql,
  activityMandatesJsonSql,
  activityTopicMatchSql,
  activityTopicRankSql,
  bindTopicSearch,
  ctAnchorMatchSql,
} from "@/lib/topic-search";

type ActivityRow = {
  id: number;
  slug: string;
  title: string;
  activity_type: string;
  enrichment_status: string;
  source_type_label: string | null;
  sort_order: number;
  estimated_minutes: number;
  ct_skills: string[];
  metadata: unknown;
  grade: number;
  chapter_code: string;
  chapter_title: string;
  anchor_curriculum: string | null;
  subject_id: number;
  subject_slug: string;
  subject_name: string;
  coach_step_count: number;
  chapter_dependent: boolean;
  mandates: ActivityMandate[] | null;
};

function mapActivityRow(row: ActivityRow): ActivityListItem {
  const meta = parseActivityMetadata(row.metadata);
  const fields = metadataToListFields(meta, row.ct_skills ?? []);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    ...fields,
    coach_step_count: row.coach_step_count ?? 0,
    estimated_minutes: row.estimated_minutes ?? 15,
    grade: row.grade,
    chapter_title: row.chapter_title,
    chapter_code: row.chapter_code,
    anchor_curriculum: row.anchor_curriculum ?? null,
    subject_id: row.subject_id,
    subject_slug: row.subject_slug,
    subject_name: row.subject_name,
    match_source: row.subject_slug === CT_PROGRAM_SLUG ? "ct_program" : "cbse_chapter",
    activity_type: row.activity_type,
    enrichment_status: row.enrichment_status,
    chapter_dependent: row.chapter_dependent,
    source_type_label: row.source_type_label,
    mandates: row.mandates ?? [],
  };
}

/**
 * Published sparks for the teacher dashboard.
 * Grade 6 integrated content lives under CBSE subject → chapter → activity.
 * CT program bank (G3) remains under subjects.slug = ct with optional cross-match.
 */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = auth.school_id;

    const gradeParam = request.nextUrl.searchParams.get("grade");
    const chapterIdParam = request.nextUrl.searchParams.get("chapter_id");
    const subjectIdParam = request.nextUrl.searchParams.get("subject_id");
    const sectionIdParam = request.nextUrl.searchParams.get("section_id");
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const mandateCode = request.nextUrl.searchParams.get("mandate_code")?.trim() || null;

    const grade = gradeParam ? parseInt(gradeParam, 10) : null;
    const chapterId = chapterIdParam ? parseInt(chapterIdParam, 10) : null;
    const subjectId = subjectIdParam ? parseInt(subjectIdParam, 10) : null;
    const sectionId = sectionIdParam ? parseInt(sectionIdParam, 10) : null;

    client = await pool.connect();

    let anchorSubjectSlug: string | null = null;
    if (subjectId && Number.isInteger(subjectId)) {
      const sub = await client.query(`SELECT slug FROM subjects WHERE id = $1`, [subjectId]);
      anchorSubjectSlug = sub.rows[0]?.slug ?? null;
    }

    const isCbseAnchor = anchorSubjectSlug != null && anchorSubjectSlug !== CT_PROGRAM_SLUG;

    function buildSchoolClause(startIdx: number): { join: string; conditions: string[]; values: unknown[] } {
      if (!sectionId || !Number.isInteger(sectionId) || !schoolId) {
        return { join: "", conditions: [], values: [] };
      }
      return {
        join: `LEFT JOIN school_content_settings scs
                 ON scs.activity_id = a.id AND scs.school_id = $${startIdx}`,
        conditions: [
          `COALESCE(scs.is_enabled, TRUE) = TRUE`,
          `EXISTS (
             SELECT 1 FROM sections sec
             JOIN classes cl ON cl.id = sec.class_id
            WHERE sec.id = $${startIdx + 1} AND cl.school_id = $${startIdx + 2}
           )`,
        ],
        values: [schoolId, sectionId, schoolId],
      };
    }

    async function queryIntegratedSparks(): Promise<ActivityListItem[]> {
      const conditions = ["a.status = 'published'", `s.slug <> $1`];
      const values: unknown[] = [CT_PROGRAM_SLUG];
      let idx = 2;
      let rankIdx: number | null = null;

      if (grade && Number.isInteger(grade)) {
        conditions.push(`c.grade = $${idx++}`);
        values.push(grade);
      }
      if (chapterId && Number.isInteger(chapterId)) {
        conditions.push(`c.id = $${idx++}`);
        values.push(chapterId);
      }
      if (subjectId && Number.isInteger(subjectId)) {
        conditions.push(`c.subject_id = $${idx++}`);
        values.push(subjectId);
      }
      if (mandateCode) {
        const parts = [`acm.mandate_code = $${idx}`];
        values.push(mandateCode);
        idx++;
        if (grade && Number.isInteger(grade)) {
          parts.push(`acm.mandate_grade = $${idx}`);
          values.push(grade);
          idx++;
        }
        conditions.push(
          `EXISTS (SELECT 1 FROM activity_cbse_mandates acm
                    WHERE acm.activity_id = a.id AND ${parts.join(" AND ")})`,
        );
      }
      if (q) {
        const binds = bindTopicSearch(values, q, idx);
        rankIdx = binds.rawIdx;
        conditions.push(
          `(${activityTopicMatchSql("a", "c", binds.patternIdx, binds.rawIdx)}
            OR ${activityMandateMatchSql("a", binds.patternIdx)})`,
        );
        idx = binds.rawIdx + 1;
      }

      const school = buildSchoolClause(idx);
      conditions.push(...school.conditions);
      values.push(...school.values);

      const orderBy = q && rankIdx != null
        ? `${activityTopicRankSql("a", "c", rankIdx)} DESC, c.chapter_code, a.sort_order, a.id`
        : "c.chapter_code, a.sort_order, a.id";

      const result = await client!.query(
        `SELECT a.id, a.slug, a.title, a.activity_type, a.enrichment_status,
                a.source_type_label, a.sort_order, a.estimated_minutes, a.ct_skills, a.metadata,
                a.chapter_dependent,
                c.grade, c.chapter_code, c.title AS chapter_title, c.anchor_curriculum,
                s.id AS subject_id, s.slug AS subject_slug, s.name AS subject_name,
                (SELECT COUNT(*)::int FROM questions qn
                  WHERE qn.activity_id = a.id AND qn.role = 'coach_step') AS coach_step_count,
                ${activityMandatesJsonSql("a")} AS mandates
           FROM activities a
           JOIN chapters c ON c.id = a.chapter_id
           JOIN subjects s ON s.id = c.subject_id
           ${school.join}
          WHERE ${conditions.join(" AND ")}
          ORDER BY ${orderBy}`,
        values,
      );

      return result.rows.map((row: ActivityRow) => mapActivityRow(row));
    }

    async function queryCtProgramSparks(): Promise<ActivityListItem[]> {
      if (!isCbseAnchor || (!q && !chapterId)) return [];

      const conditions = ["a.status = 'published'", `s.slug = $1`];
      const values: unknown[] = [CT_PROGRAM_SLUG];
      let idx = 2;
      let rankIdx: number | null = null;

      if (grade && Number.isInteger(grade)) {
        conditions.push(`c.grade = $${idx++}`);
        values.push(grade);
      }
      if (mandateCode) {
        const parts = [`acm.mandate_code = $${idx}`];
        values.push(mandateCode);
        idx++;
        if (grade && Number.isInteger(grade)) {
          parts.push(`acm.mandate_grade = $${idx}`);
          values.push(grade);
          idx++;
        }
        conditions.push(
          `EXISTS (SELECT 1 FROM activity_cbse_mandates acm
                    WHERE acm.activity_id = a.id AND ${parts.join(" AND ")})`,
        );
      }

      const topicParts: string[] = [];
      let searchBinds: { patternIdx: number; rawIdx: number } | null = null;

      if (q) {
        searchBinds = bindTopicSearch(values, q, idx);
        rankIdx = searchBinds.rawIdx;
        topicParts.push(
          activityTopicMatchSql("a", "c", searchBinds.patternIdx, searchBinds.rawIdx),
        );
        topicParts.push(activityMandateMatchSql("a", searchBinds.patternIdx));
        idx = searchBinds.rawIdx + 1;

        if (subjectId && Number.isInteger(subjectId)) {
          topicParts.push(
            `EXISTS (
               SELECT 1 FROM activity_cbse_anchors aca
              WHERE aca.activity_id = a.id
                AND aca.subject_id = $${idx}
                AND (
                  EXISTS (
                    SELECT 1 FROM unnest(COALESCE(aca.topic_keywords, '{}')) AS akw
                    WHERE akw ILIKE $${searchBinds.patternIdx}
                       OR similarity(akw, $${searchBinds.rawIdx}) > 0.25
                  )
                  OR similarity(aca.chapter_title, $${searchBinds.rawIdx}) > 0.2
                )
             )`,
          );
          values.push(subjectId);
          idx++;
        }
      }
      if (chapterId && Number.isInteger(chapterId)) {
        if (q && searchBinds) {
          topicParts.push(
            ctAnchorMatchSql("a", idx, searchBinds.patternIdx, searchBinds.rawIdx),
          );
        } else {
          topicParts.push(
            `EXISTS (
               SELECT 1 FROM chapters anchor_ch
              WHERE anchor_ch.id = $${idx}
                AND (
                  c.title ILIKE '%' || anchor_ch.title || '%'
                  OR a.metadata->>'theme' ILIKE '%' || anchor_ch.title || '%'
                  OR anchor_ch.title ILIKE '%' || c.title || '%'
                )
             )`,
          );
        }
        values.push(chapterId);
        idx++;
      }

      if (topicParts.length === 0) return [];
      conditions.push(`(${topicParts.join(" OR ")})`);

      const school = buildSchoolClause(idx);
      conditions.push(...school.conditions);
      values.push(...school.values);

      const orderBy = q && rankIdx != null
        ? `${activityTopicRankSql("a", "c", rankIdx)} DESC, a.sort_order, a.id`
        : "a.sort_order, a.id";

      const result = await client!.query(
        `SELECT a.id, a.slug, a.title, a.activity_type, a.enrichment_status,
                a.source_type_label, a.sort_order, a.estimated_minutes, a.ct_skills, a.metadata,
                a.chapter_dependent,
                c.grade, c.chapter_code, c.title AS chapter_title, c.anchor_curriculum,
                s.id AS subject_id, s.slug AS subject_slug, s.name AS subject_name,
                (SELECT COUNT(*)::int FROM questions qn
                  WHERE qn.activity_id = a.id AND qn.role = 'coach_step') AS coach_step_count,
                ${activityMandatesJsonSql("a")} AS mandates
           FROM activities a
           JOIN chapters c ON c.id = a.chapter_id
           JOIN subjects s ON s.id = c.subject_id
           ${school.join}
          WHERE ${conditions.join(" AND ")}
          ORDER BY ${orderBy}`,
        values,
      );

      return result.rows.map((row: ActivityRow) => mapActivityRow(row));
    }

    const integrated = await queryIntegratedSparks();
    const ctExtra = await queryCtProgramSparks();

    const seen = new Set<number>();
    const items: ActivityListItem[] = [];
    for (const item of [...integrated, ...ctExtra]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }

    const cbseCount = items.filter((i) => i.match_source === "cbse_chapter").length;
    const ctCount = items.filter((i) => i.match_source === "ct_program").length;
    const first = items[0];

    return NextResponse.json(
      {
        items,
        total: items.length,
        counts: { cbse_chapter: cbseCount, ct_program: ctCount },
        filters: {
          grade: grade ?? null,
          subject_id: subjectId ?? null,
          chapter_id: chapterId ?? null,
          section_id: sectionId ?? null,
          q: q || null,
          mandate_code: mandateCode,
          anchor_subject_slug: anchorSubjectSlug,
          fuzzy: !!q,
        },
        chapter: first
          ? {
              code: first.chapter_code,
              title: first.chapter_title,
              grade: first.grade,
              subject_name: first.subject_name,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching activities");
  } finally {
    if (client) client.release();
  }
}
