export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";
import {
  bindTopicSearch,
  chapterTopicMatchSql,
  chapterTopicRankSql,
} from "@/lib/topic-search";

/** CBSE anchor chapters for lesson mapping — with or without published quests yet. */
export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    const subjectId = parseInt(request.nextUrl.searchParams.get("subject_id") ?? "", 10);
    const grade = parseInt(request.nextUrl.searchParams.get("grade") ?? "", 10);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!Number.isInteger(subjectId)) {
      return NextResponse.json({ message: "subject_id is required" }, { status: 400 });
    }

    const conditions = ["c.subject_id = $1"];
    const values: unknown[] = [subjectId];
    let idx = 2;
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

    const orderBy = q && rankIdx != null
      ? `${chapterTopicRankSql("c", rankIdx)} DESC, c.grade, c.chapter_code`
      : "c.grade, c.chapter_code";

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
                WHERE a.chapter_id = c.id AND a.status = 'published') AS quest_count
         FROM chapters c
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
