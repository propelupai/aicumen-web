export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertTeacherAccount } from "@/lib/rbac";
import {
  type ActivityDetail,
  type QuestionRow,
  metadataToListFields,
  parseActivityMetadata,
} from "@/lib/activities";

type RouteContext = { params: Promise<{ id: string }> };

function mapQuestion(row: Record<string, unknown>): QuestionRow {
  return {
    id: row.id as number,
    role: row.role as string,
    sort_order: row.sort_order as number,
    label: (row.label as string) ?? null,
    stem: row.stem as string,
    hint: (row.hint as string) ?? null,
    context: (row.context as Record<string, unknown>) ?? {},
    delivery: (row.delivery as Record<string, unknown>) ?? null,
    answer_spec: (row.answer_spec as Record<string, unknown>) ?? null,
    teacher_notes: (row.teacher_notes as string) ?? null,
  };
}

/** Full activity payload for live session (stem + coach ladder + extend). */
export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);

    const { id } = await context.params;
    const activityId = parseInt(id, 10);
    if (!Number.isInteger(activityId)) {
      return NextResponse.json({ message: "Invalid activity id" }, { status: 400 });
    }

    client = await pool.connect();

    const actResult = await client.query(
      `SELECT a.id, a.slug, a.title, a.activity_type, a.estimated_minutes,
              a.ct_skills, a.ai_concept, a.metadata,
              c.grade, c.chapter_code, c.title AS chapter_title,
              s.name AS subject_name, s.slug AS subject_slug
         FROM activities a
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
        WHERE a.id = $1 AND a.status = 'published'`,
      [activityId],
    );

    if (actResult.rows.length === 0) {
      return NextResponse.json({ message: "Activity not found" }, { status: 404 });
    }

    const row = actResult.rows[0];
    const meta = parseActivityMetadata(row.metadata);
    const fields = metadataToListFields(meta, row.ct_skills ?? []);

    const qResult = await client.query(
      `SELECT id, role, sort_order, label, stem, hint, context, delivery,
              answer_spec, teacher_notes
         FROM questions
        WHERE activity_id = $1
        ORDER BY sort_order, id`,
      [activityId],
    );

    const questions = qResult.rows.map(mapQuestion);
    const stem = questions.find((q) => q.role === "stem") ?? null;
    const coach_steps = questions.filter((q) => q.role === "coach_step");
    const extend = questions.find((q) => q.role === "extend") ?? null;

    const detail: ActivityDetail = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      activity_type: row.activity_type,
      ai_concept: row.ai_concept,
      ct_skills: row.ct_skills ?? [],
      ...fields,
      coach_step_count: coach_steps.length,
      estimated_minutes: row.estimated_minutes ?? 15,
      grade: row.grade,
      chapter_title: row.chapter_title,
      chapter_code: row.chapter_code,
      subject_name: row.subject_name,
      subject_slug: row.subject_slug,
      stem,
      coach_steps,
      extend,
    };

    return NextResponse.json(detail, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching activity");
  } finally {
    if (client) client.release();
  }
}
