export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount } from "@/lib/rbac";
import {
  type ActivityListItem,
  metadataToListFields,
  parseActivityMetadata,
} from "@/lib/activities";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = new Set(["completed", "in_progress", "skipped", "not_started"]);

type Row = {
  id: number;
  slug: string;
  title: string;
  activity_type: string;
  source_type_label: string | null;
  estimated_minutes: number;
  ct_skills: string[];
  metadata: unknown;
  chapter_code: string;
  chapter_title: string;
  grade: number;
  subject_id: number;
  subject_slug: string;
  subject_name: string;
  progress_status: string;
  completed_at: string | null;
  updated_at: string;
  coach_step_count: number;
};

/** Section-scoped activity history (completed / in progress) — not limited by curriculum track. */
export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    const statusParam = request.nextUrl.searchParams.get("status")?.trim() ?? "completed";
    const subjectId = parseInt(request.nextUrl.searchParams.get("subject_id") ?? "", 10);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!ALLOWED_STATUSES.has(statusParam) && statusParam !== "all") {
      return NextResponse.json({ message: "Invalid status filter" }, { status: 400 });
    }

    client = await pool.connect();

    const sectionCheck = await client.query(
      `SELECT sec.id, sec.display_name, c.grade
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
        WHERE sec.id = $1 AND c.school_id = $2`,
      [sectionId, schoolId],
    );
    if (sectionCheck.rows.length === 0) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    const conditions = ["p.section_id = $1"];
    const values: unknown[] = [sectionId];
    let idx = 2;

    if (statusParam !== "all") {
      conditions.push(`p.status = $${idx++}`);
      values.push(statusParam);
    } else {
      conditions.push(`p.status <> 'not_started'`);
    }

    if (Number.isInteger(subjectId)) {
      conditions.push(`c.subject_id = $${idx++}`);
      values.push(subjectId);
    }

    if (q) {
      conditions.push(
        `(a.title ILIKE $${idx} OR a.external_id ILIKE $${idx} OR c.title ILIKE $${idx}
          OR c.chapter_code ILIKE $${idx} OR a.metadata->>'theme' ILIKE $${idx}
          OR a.source_type_label ILIKE $${idx} OR s.name ILIKE $${idx})`,
      );
      values.push(`%${q}%`);
      idx++;
    }

    const result = await client.query(
      `SELECT a.id, a.slug, a.title, a.activity_type, a.source_type_label, a.estimated_minutes,
              a.ct_skills, a.metadata,
              c.chapter_code, c.title AS chapter_title, c.grade,
              s.id AS subject_id, s.slug AS subject_slug, s.name AS subject_name,
              p.status AS progress_status, p.completed_at, p.updated_at,
              (SELECT COUNT(*)::int FROM questions qn
                 WHERE qn.activity_id = a.id AND qn.role = 'coach_step') AS coach_step_count
         FROM section_activity_progress p
         JOIN activities a ON a.id = p.activity_id
         JOIN chapters c ON c.id = a.chapter_id
         JOIN subjects s ON s.id = c.subject_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY p.completed_at DESC NULLS LAST, p.updated_at DESC, a.title`,
      values,
    );

    const items = result.rows.map((row: Row) => {
      const meta = parseActivityMetadata(row.metadata);
      const fields = metadataToListFields(meta, row.ct_skills ?? []);
      const item: ActivityListItem & {
        progress_status: string;
        completed_at: string | null;
        updated_at: string;
      } = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        ...fields,
        coach_step_count: row.coach_step_count ?? 0,
        estimated_minutes: row.estimated_minutes ?? 15,
        grade: row.grade,
        chapter_title: row.chapter_title,
        chapter_code: row.chapter_code,
        subject_id: row.subject_id,
        subject_slug: row.subject_slug,
        subject_name: row.subject_name,
        activity_type: row.activity_type,
        source_type_label: row.source_type_label,
        progress_status: row.progress_status,
        completed_at: row.completed_at,
        updated_at: row.updated_at,
      };
      return item;
    });

    const section = sectionCheck.rows[0];
    return NextResponse.json(
      {
        section: {
          id: section.id,
          display_name: section.display_name,
          grade: section.grade,
        },
        items,
        total: items.length,
        filters: {
          status: statusParam,
          subject_id: Number.isInteger(subjectId) ? subjectId : null,
          q: q || null,
        },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching completed activities");
  } finally {
    if (client) client.release();
  }
}
