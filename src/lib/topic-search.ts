/**
 * Topic / chapter fuzzy search helpers (requires migration 009: pg_trgm + topic_keywords).
 * Uses ILIKE substring match plus pg_trgm similarity for typo-tolerant search.
 */

export type TopicSearchParams = {
  patternIdx: number;
  rawIdx: number;
};

/** Append `%q%` pattern and raw `q` to query values; returns bind indices. */
export function bindTopicSearch(values: unknown[], q: string, startIdx: number): TopicSearchParams {
  values.push(`%${q}%`, q);
  return { patternIdx: startIdx, rawIdx: startIdx + 1 };
}

/** Match chapter title, code, anchors, and topic_keywords (substring + fuzzy). */
export function chapterTopicMatchSql(
  alias: string,
  patternIdx: number,
  rawIdx: number,
): string {
  const p = `$${patternIdx}`;
  const r = `$${rawIdx}`;
  return `(
    ${alias}.title ILIKE ${p}
    OR ${alias}.chapter_code ILIKE ${p}
    OR COALESCE(${alias}.anchor_curriculum, '') ILIKE ${p}
    OR COALESCE(${alias}.anchor_reference, '') ILIKE ${p}
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(${alias}.topic_keywords, '{}')) AS kw
      WHERE kw ILIKE ${p}
         OR similarity(kw, ${r}) > 0.25
    )
    OR similarity(${alias}.title, ${r}) > 0.2
    OR word_similarity(${r}, ${alias}.title) > 0.35
  )`;
}

/** Relevance score for ranking chapter search results (higher = better match). */
export function chapterTopicRankSql(alias: string, rawIdx: number): string {
  const r = `$${rawIdx}`;
  return `GREATEST(
    similarity(${alias}.title, ${r}),
    word_similarity(${r}, ${alias}.title),
    COALESCE((
      SELECT MAX(
        GREATEST(
          similarity(kw, ${r}),
          CASE WHEN kw ILIKE '%' || ${r} || '%' THEN 0.55 ELSE 0 END
        )
      )
      FROM unnest(COALESCE(${alias}.topic_keywords, '{}')) AS kw
    ), 0)
  )`;
}

/** Match activity fields plus its chapter topic signals. */
export function activityTopicMatchSql(
  activityAlias: string,
  chapterAlias: string,
  patternIdx: number,
  rawIdx: number,
): string {
  const p = `$${patternIdx}`;
  const r = `$${rawIdx}`;
  return `(
    ${activityAlias}.title ILIKE ${p}
    OR COALESCE(${activityAlias}.external_id, '') ILIKE ${p}
    OR COALESCE(${activityAlias}.source_type_label, '') ILIKE ${p}
    OR COALESCE(${activityAlias}.metadata->>'theme', '') ILIKE ${p}
    OR EXISTS (
      SELECT 1 FROM questions qn
      WHERE qn.activity_id = ${activityAlias}.id
        AND qn.role IN ('stem', 'coach_step')
        AND (qn.stem ILIKE ${p} OR similarity(qn.stem, ${r}) > 0.15)
    )
    OR ${chapterTopicMatchSql(chapterAlias, patternIdx, rawIdx)}
  )`;
}

/** Relevance score for activity search results. */
export function activityTopicRankSql(
  activityAlias: string,
  chapterAlias: string,
  rawIdx: number,
): string {
  const r = `$${rawIdx}`;
  return `GREATEST(
    ${chapterTopicRankSql(chapterAlias, rawIdx)},
    similarity(${activityAlias}.title, ${r}),
    word_similarity(${r}, ${activityAlias}.title),
    CASE WHEN COALESCE(${activityAlias}.metadata->>'theme', '') ILIKE '%' || ${r} || '%' THEN 0.45 ELSE 0 END
  )`;
}

/** Match an activity's CBSE mandate tags by code or handbook item (substring). */
export function activityMandateMatchSql(activityAlias: string, patternIdx: number): string {
  const p = `$${patternIdx}`;
  return `EXISTS (
    SELECT 1 FROM activity_cbse_mandates acm
    JOIN cbse_mandates m
      ON m.grade = acm.mandate_grade AND m.code = acm.mandate_code
    WHERE acm.activity_id = ${activityAlias}.id
      AND (m.code ILIKE ${p} OR m.handbook_item ILIKE ${p} OR COALESCE(m.unit, '') ILIKE ${p})
  )`;
}

/** Correlated subquery returning an activity's mandates as a JSON array. */
export function activityMandatesJsonSql(activityAlias: string): string {
  return `COALESCE((
    SELECT json_agg(
             json_build_object(
               'grade', m.grade,
               'code', m.code,
               'handbook_item', m.handbook_item,
               'unit', m.unit
             ) ORDER BY m.sort_order, m.code
           )
      FROM activity_cbse_mandates acm
      JOIN cbse_mandates m
        ON m.grade = acm.mandate_grade AND m.code = acm.mandate_code
     WHERE acm.activity_id = ${activityAlias}.id
  ), '[]'::json)`;
}

/** CT-program quest matched to a CBSE lesson via activity_cbse_anchors. */
export function ctAnchorMatchSql(
  activityAlias: string,
  anchorChapterIdIdx: number,
  patternIdx: number,
  rawIdx: number,
): string {
  const chId = `$${anchorChapterIdIdx}`;
  const p = `$${patternIdx}`;
  const r = `$${rawIdx}`;
  return `EXISTS (
    SELECT 1 FROM chapters anchor_ch
    WHERE anchor_ch.id = ${chId}
      AND (
        ${chapterTopicMatchSql("anchor_ch", patternIdx, rawIdx)}
        OR EXISTS (
          SELECT 1 FROM activity_cbse_anchors aca
          WHERE aca.activity_id = ${activityAlias}.id
            AND aca.chapter_id = anchor_ch.id
            AND (
              EXISTS (
                SELECT 1 FROM unnest(COALESCE(aca.topic_keywords, '{}')) AS akw
                WHERE akw ILIKE ${p} OR similarity(akw, ${r}) > 0.25
              )
              OR similarity(aca.chapter_title, ${r}) > 0.2
            )
        )
      )
  )`;
}
