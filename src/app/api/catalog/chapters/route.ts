export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount } from "@/lib/rbac";
import {
  bindTopicSearch,
  chapterTopicMatchSql,
  chapterTopicRankSql,
} from "@/lib/topic-search";
import {
  schoolActivityVisibleSql,
  schoolChapterEnabledSql,
  schoolChapterSortSql,
  schoolSubjectEnabledSql,
} from "@/lib/school-overlays";

/** Chapters for lesson mapping — school overlays applied to visibility + counts. */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    const subjectId = parseInt(request.nextUrl.searchParams.get("subject_id") ?? "", 10);
    const grade = parseInt(request.nextUrl.searchParams.get("grade") ?? "", 10);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!Number.isInteger(subjectId)) {
      return NextResponse.json({ message: "subject_id is required" }, { status: 400 });
    }

    const schoolParam = "$1";
    const conditions = [
      `c.subject_id = $2`,
      schoolSubjectEnabledSql(schoolParam, "s"),
      schoolChapterEnabledSql(schoolParam, "c"),
    ];
    const values: unknown[] = [schoolId, subjectId];
    let idx = 3;
    let rankIdx: number | null = null;

    if (Number.isInteger(grade)) {
      conditions.push(`c.grade = $${idx++}`);
      values.push(grade);
    }
    if (q) {
      const binds = bindTopicSearch(values, q, idx);
      rankIdx = binds.rawIdx;
      conditions.push(chapterTopicMatchSql("c", binds.patternIdx, binds.rawIdx));
      idx = binds.rawIdx + 1;
    }

    const chapterSort = schoolChapterSortSql(schoolParam, "c");
    const orderBy =
      q && rankIdx != null
        ? `${chapterTopicRankSql("c", rankIdx)} DESC, ${chapterSort}, c.chapter_code`
        : `${chapterSort}, c.grade, c.chapter_code`;

    const visible = schoolActivityVisibleSql(schoolParam, "a", "c", "s");

    client = await pool.connect();
    const result = await client.query(
      `SELECT c.id,
              c.chapter_code,
              c.title,
              c.grade,
              c.anchor_curriculum,
              c.anchor_reference,
              (SELECT COUNT(*)::int
                 FROM activities a
                WHERE a.chapter_id = c.id
                  AND a.status = 'published'
                  AND ${visible}) AS quest_count
         FROM chapters c
         JOIN subjects s ON s.id = c.subject_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${orderBy}`,
      values,
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching catalog chapters");
  } finally {
    if (client) client.release();
  }
}
