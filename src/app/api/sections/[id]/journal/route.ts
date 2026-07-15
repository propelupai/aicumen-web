export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { assertActiveSchool, assertTeacherAccount, requirePermission } from "@/lib/rbac";
import { isJournalLevel } from "@/lib/journal";

type RouteContext = { params: Promise<{ id: string }> };

type ActivityMeta = {
  activity_id: number;
  title: string;
  quest_code: string | null;
  chapter_title: string | null;
  subject_name: string | null;
  grade: number | null;
};

type RosterEntry = {
  student_user_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  level: string | null;
  remark: string | null;
  assessed_at: string | null;
};

async function getSectionMeta(
  client: import("pg").PoolClient,
  sectionId: number,
  schoolId: number,
): Promise<{ section_id: number; display_name: string; class_name: string; grade: number } | null> {
  const r = await client.query<{
    section_id: number;
    display_name: string;
    class_name: string;
    grade: number;
  }>(
    `SELECT s.id AS section_id, s.display_name, c.name AS class_name, c.grade
       FROM sections s
       JOIN classes c ON c.id = s.class_id
      WHERE s.id = $1 AND s.is_active = TRUE AND c.school_id = $2`,
    [sectionId, schoolId],
  );
  return r.rows[0] ?? null;
}

async function getActivityMeta(
  client: import("pg").PoolClient,
  activityId: number,
): Promise<ActivityMeta | null> {
  const r = await client.query<ActivityMeta>(
    `SELECT a.id AS activity_id,
            a.title,
            a.metadata->>'quest_code' AS quest_code,
            c.title AS chapter_title,
            c.grade,
            s.name AS subject_name
       FROM activities a
       JOIN chapters c ON c.id = a.chapter_id
       JOIN subjects s ON s.id = c.subject_id
      WHERE a.id = $1`,
    [activityId],
  );
  return r.rows[0] ?? null;
}

async function getRoster(
  client: import("pg").PoolClient,
  sectionId: number,
  activityId: number,
): Promise<RosterEntry[]> {
  const r = await client.query<RosterEntry>(
    `SELECT u.user_id AS student_user_id,
            u.display_name,
            u.email,
            u.username,
            j.level,
            j.remark,
            j.assessed_at
       FROM student_enrollments se
       JOIN users u ON u.user_id = se.user_id
       LEFT JOIN student_activity_journal j
         ON j.student_user_id = u.user_id
        AND j.section_id = se.section_id
        AND j.activity_id = $2
      WHERE se.section_id = $1
        AND se.status = 'active'
        AND u.is_active = TRUE
      ORDER BY COALESCE(NULLIF(TRIM(u.display_name), ''), u.email)`,
    [sectionId, activityId],
  );
  return r.rows;
}

export async function GET(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "journal", "write");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    const activityId = parseInt(request.nextUrl.searchParams.get("activity_id") ?? "", 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }
    if (!Number.isInteger(activityId)) {
      return NextResponse.json({ message: "activity_id is required" }, { status: 400 });
    }

    client = await pool.connect();
    const section = await getSectionMeta(client, sectionId, schoolId);
    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }
    const activity = await getActivityMeta(client, activityId);
    if (!activity) {
      return NextResponse.json({ message: "Activity not found" }, { status: 404 });
    }

    const roster = await getRoster(client, sectionId, activityId);
    return NextResponse.json({ section, activity, roster }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error fetching journal");
  } finally {
    if (client) client.release();
  }
}

/**
 * Bulk upsert journal marks for a section+activity.
 * Body: { activity_id, entries: [{ student_user_id, level|null, remark|null }] }
 * A "mark whole class" action is done client-side by sending the same level for all entries.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(request);
    assertTeacherAccount(auth);
    const schoolId = assertActiveSchool(auth);
    requirePermission(auth, "journal", "write");

    const { id } = await context.params;
    const sectionId = parseInt(id, 10);
    if (!Number.isInteger(sectionId)) {
      return NextResponse.json({ message: "Invalid section id" }, { status: 400 });
    }

    const body = await request.json();
    const activityId = parseInt(String(body?.activity_id ?? ""), 10);
    if (!Number.isInteger(activityId)) {
      return NextResponse.json({ message: "activity_id is required" }, { status: 400 });
    }

    const rawEntries: unknown[] = Array.isArray(body?.entries) ? body.entries : [];
    type CleanEntry = { student_user_id: string; level: string | null; remark: string | null };
    const entries: CleanEntry[] = [];
    for (const raw of rawEntries) {
      const e = raw as Record<string, unknown>;
      const studentId = String(e?.student_user_id ?? "").trim();
      if (!studentId) continue;
      const level = e?.level == null || e.level === "" ? null : String(e.level);
      if (level !== null && !isJournalLevel(level)) {
        return NextResponse.json({ message: `Invalid level: ${level}` }, { status: 400 });
      }
      const remarkRaw = e?.remark == null ? null : String(e.remark).trim();
      const remark = remarkRaw ? remarkRaw.slice(0, 2000) : null;
      entries.push({ student_user_id: studentId, level, remark });
    }

    client = await pool.connect();
    const section = await getSectionMeta(client, sectionId, schoolId);
    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }
    const activity = await getActivityMeta(client, activityId);
    if (!activity) {
      return NextResponse.json({ message: "Activity not found" }, { status: 404 });
    }

    // Restrict to students actively enrolled in this section.
    const enrolled = await client.query<{ user_id: string }>(
      `SELECT u.user_id
         FROM student_enrollments se
         JOIN users u ON u.user_id = se.user_id
        WHERE se.section_id = $1 AND se.status = 'active' AND u.is_active = TRUE`,
      [sectionId],
    );
    const enrolledSet = new Set(enrolled.rows.map((r) => r.user_id));
    const invalid = entries.filter((e) => !enrolledSet.has(e.student_user_id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { message: "One or more students are not enrolled in this section." },
        { status: 400 },
      );
    }

    await client.query("BEGIN");
    for (const e of entries) {
      if (e.level === null && e.remark === null) {
        // Clear an existing entry entirely.
        await client.query(
          `DELETE FROM student_activity_journal
            WHERE section_id = $1 AND activity_id = $2 AND student_user_id = $3`,
          [sectionId, activityId, e.student_user_id],
        );
        continue;
      }
      await client.query(
        `INSERT INTO student_activity_journal
           (section_id, activity_id, student_user_id, level, remark, assessed_by, assessed_at)
         VALUES ($1, $2, $3, $4::text, $5, $6, CASE WHEN $4::text IS NULL THEN NULL ELSE NOW() END)
         ON CONFLICT (section_id, activity_id, student_user_id) DO UPDATE
           SET level = EXCLUDED.level,
               remark = EXCLUDED.remark,
               assessed_by = EXCLUDED.assessed_by,
               assessed_at = CASE
                 WHEN EXCLUDED.level IS NULL THEN NULL
                 WHEN student_activity_journal.level IS DISTINCT FROM EXCLUDED.level THEN NOW()
                 ELSE student_activity_journal.assessed_at
               END,
               updated_at = NOW()`,
        [sectionId, activityId, e.student_user_id, e.level, e.remark, auth.user_id],
      );
    }
    await client.query("COMMIT");

    const roster = await getRoster(client, sectionId, activityId);
    return NextResponse.json({ section, activity, roster }, { status: 200 });
  } catch (err: unknown) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return apiErrorResponse(err, "Error saving journal");
  } finally {
    if (client) client.release();
  }
}
