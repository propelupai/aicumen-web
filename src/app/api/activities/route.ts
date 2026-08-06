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
import { AI_PROGRAM_SLUG, CT_PROGRAM_SLUG, subjectKindFromSlug } from "@/lib/subjects";
import {
  schoolActivitySortSql,
  schoolActivityVisibleSql,
} from "@/lib/school-overlays";
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
    match_source:
      row.subject_slug === CT_PROGRAM_SLUG
        ? "ct_program"
        : row.subject_slug === AI_PROGRAM_SLUG
          ? "ai_program"
          : "cbse_chapter",
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

    const anchorKind = anchorSubjectSlug ? subjectKindFromSlug(anchorSubjectSlug) : null;
    const isAiProgram = anchorKind === "ai_program";
    const isCbseAnchor = anchorKind === "cbse_anchor";

    function buildSchoolClause(startIdx: number): {
      join: string;
      conditions: string[];
      values: unknown[];
      schoolParam: string | null;
    } {
      if (!schoolId || !Number.isInteger(schoolId)) {
        return { join: "", conditions: [], values: [], schoolParam: null };
      }
      const schoolParam = `$${startIdx}`;
      const conditions = [schoolActivityVisibleSql(schoolParam, "a", "c", "s")];
      const values: unknown[] = [schoolId];
      let next = startIdx + 1;

      if (sectionId && Number.isInteger(sectionId)) {
        conditions.push(
          `EXISTS (
             SELECT 1 FROM sections sec
             JOIN classes cl ON cl.id = sec.class_id
            WHERE sec.id = $${next} AND cl.school_id = $${next + 1}
           )`,
        );
        values.push(sectionId, schoolId);
        next += 2;
      }

      return { join: "", conditions, values, schoolParam };
    }

    async function queryIntegratedSparks(): Promise<ActivityListItem[]> {
      // AI tab: only AI subject tree. CT tab: CBSE anchors (exclude ct + ai roots).
      const conditions = ["a.status = 'published'"];
      const values: unknown[] = [];
      let idx = 1;
      let rankIdx: number | null = null;

      if (isAiProgram) {
        conditions.push(`s.slug = $${idx++}`);
        values.push(AI_PROGRAM_SLUG);
      } else {
        conditions.push(`s.slug NOT IN ($${idx++}, $${idx++})`);
        values.push(CT_PROGRAM_SLUG, AI_PROGRAM_SLUG);
      }

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

      const activitySort = school.schoolParam
        ? schoolActivitySortSql(school.schoolParam, "a")
        : "a.sort_order";

      const orderBy = q && rankIdx != null
        ? `${activityTopicRankSql("a", "c", rankIdx)} DESC, c.chapter_code, ${activitySort}, a.id`
        : `c.chapter_code, ${activitySort}, a.id`;

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

      const activitySort = school.schoolParam
        ? schoolActivitySortSql(school.schoolParam, "a")
        : "a.sort_order";

      const orderBy = q && rankIdx != null
        ? `${activityTopicRankSql("a", "c", rankIdx)} DESC, ${activitySort}, a.id`
        : `${activitySort}, a.id`;

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
    // CT cross-match only when browsing a CBSE lesson — never on the AI tab.
    const ctExtra = isAiProgram ? [] : await queryCtProgramSparks();

    const seen = new Set<number>();
    const items: ActivityListItem[] = [];
    for (const item of [...integrated, ...ctExtra]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }

    const cbseCount = items.filter((i) => i.match_source === "cbse_chapter").length;
    const ctCount = items.filter((i) => i.match_source === "ct_program").length;
    const aiCount = items.filter((i) => i.match_source === "ai_program").length;
    const first = items[0];

    return NextResponse.json(
      {
        items,
        total: items.length,
        counts: { cbse_chapter: cbseCount, ct_program: ctCount, ai_program: aiCount },
        filters: {
          grade: grade ?? null,
          subject_id: subjectId ?? null,
          chapter_id: chapterId ?? null,
          section_id: sectionId ?? null,
          q: q || null,
          mandate_code: mandateCode,
          anchor_subject_slug: anchorSubjectSlug,
          program_track: isAiProgram ? "ai" : "ct",
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
