"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardList, Loader2, ShieldCheck, Sparkles, User } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import {
  JournalRosterEditor,
  LevelDistribution,
} from "@/components/journal-roster-editor";
import { JOURNAL_LEVELS, JOURNAL_LEVEL_META, type JournalLevel, isJournalLevel } from "@/lib/journal";

type TeacherSection = {
  id: number;
  display_name: string;
  grade: number;
  is_primary?: boolean;
};

type TeacherSectionsResponse = {
  sections: TeacherSection[];
  source: "assigned" | "school";
};

type JournalTab = "mark" | "class" | "student";

export default function JournalPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialSectionId = (() => {
    const v = parseInt(searchParams.get("section_id") ?? "", 10);
    return Number.isInteger(v) ? v : null;
  })();
  const initialActivityId = (() => {
    const v = parseInt(searchParams.get("activity_id") ?? "", 10);
    return Number.isInteger(v) ? v : null;
  })();
  const [sectionId, setSectionId] = useState<number | null>(initialSectionId);
  const [tab, setTab] = useState<JournalTab>("mark");

  const { data: teacherSections } = useQuery<TeacherSectionsResponse>({
    queryKey: ["/api/teachers/me/sections"],
    queryFn: async () => {
      const res = await fetch("/api/teachers/me/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
    enabled: !!user,
  });

  const sections = useMemo(() => teacherSections?.sections ?? [], [teacherSections]);

  useEffect(() => {
    if (sectionId || sections.length === 0) return;
    const primary = sections.find((s) => s.is_primary) ?? sections[0];
    setSectionId(primary.id);
  }, [sections, sectionId]);

  const tabs: { key: JournalTab; label: string; icon: typeof ClipboardList }[] = [
    { key: "mark", label: "Mark work", icon: ClipboardList },
    { key: "class", label: "Class insights", icon: BarChart3 },
    { key: "student", label: "Student insights", icon: User },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">Journal</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Observe &amp; track mastery
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Mark each student on the mastery ladder — <strong>Got answer → Got rule → Able to
          teach</strong> — for the quests you run. Then see how the class and each student are
          progressing across subjects and CBSE mandates.
        </p>
        <LevelLegend className="mt-4" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Class section</span>
          {teacherSections?.source === "assigned" && (
            <span className="ml-2 text-xs font-normal text-slate-400">· your assigned sections</span>
          )}
          {sections.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              No sections yet. Set up classes and sections in the School page first.
            </p>
          ) : (
            <select
              value={sectionId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setSectionId(Number.isInteger(id) ? id : null);
              }}
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name} · Grade {s.grade}
                </option>
              ))}
            </select>
          )}
        </label>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "border border-b-0 border-slate-200 bg-white text-teal-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {sectionId == null ? (
        <p className="text-sm text-slate-500">Select a section to begin.</p>
      ) : tab === "mark" ? (
        <MarkTab sectionId={sectionId} initialActivityId={initialActivityId} />
      ) : tab === "class" ? (
        <ClassInsightsTab sectionId={sectionId} />
      ) : (
        <StudentInsightsTab sectionId={sectionId} />
      )}
    </div>
  );
}

function LevelLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {JOURNAL_LEVELS.map((lvl) => {
        const meta = JOURNAL_LEVEL_META[lvl];
        return (
          <div key={lvl} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${meta.barClass}`} />
            <span className="text-xs font-medium text-slate-700">{meta.label}</span>
            <span className="hidden text-xs text-slate-400 sm:inline">· {meta.description}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mark tab
// ---------------------------------------------------------------------------

type RecordedActivity = {
  id: number;
  title: string;
  quest_code: string;
  chapter_title: string;
  subject_name?: string;
  progress_status?: string;
};

function MarkTab({
  sectionId,
  initialActivityId,
}: {
  sectionId: number;
  initialActivityId?: number | null;
}) {
  const [activityId, setActivityId] = useState<number | null>(initialActivityId ?? null);

  const { data: recorded, isLoading: recordedLoading } = useQuery<{ items: RecordedActivity[] }>({
    queryKey: ["/api/sections/completed", sectionId, "all-for-journal"],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/completed?status=all`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
  });

  const activities = recorded?.items ?? [];

  const prevSectionRef = useRef(sectionId);
  useEffect(() => {
    if (prevSectionRef.current === sectionId) return;
    prevSectionRef.current = sectionId;
    setActivityId(null);
  }, [sectionId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Activity to mark</span>
          {recordedLoading ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-teal-700" /> Loading activities…
            </div>
          ) : activities.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              No activities have been run with this section yet. Run a live session first, then come
              back to mark it.
            </p>
          ) : (
            <select
              value={activityId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setActivityId(Number.isInteger(id) ? id : null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="">Select an activity…</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.quest_code ? `${a.quest_code} · ` : ""}
                  {a.title}
                  {a.chapter_title ? ` — ${a.chapter_title}` : ""}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {activityId == null ? (
        <p className="text-sm text-slate-500">Pick an activity above to mark the class.</p>
      ) : (
        <JournalRosterEditor sectionId={sectionId} activityId={activityId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Class insights tab
// ---------------------------------------------------------------------------

type LevelCountRow = {
  got_answer: number;
  got_rule: number;
  able_to_teach: number;
};

type ClassSummary = {
  section: {
    section_id: number;
    display_name: string;
    class_name: string;
    grade: number;
    academic_year_label: string;
  };
  enrolled_count: number;
  activities: (LevelCountRow & {
    activity_id: number;
    title: string;
    quest_code: string | null;
    chapter_title: string | null;
    subject_name: string | null;
    assessed: number;
    last_updated: string | null;
  })[];
  mandates: (LevelCountRow & {
    grade: number;
    code: string;
    handbook_item: string;
    unit: string | null;
    students_assessed: number;
  })[];
  subjects: (LevelCountRow & {
    subject_id: number;
    subject_name: string;
    students_assessed: number;
  })[];
};

function ClassInsightsTab({ sectionId }: { sectionId: number }) {
  const { data, isLoading } = useQuery<ClassSummary>({
    queryKey: ["/api/sections/journal-summary", sectionId],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/journal/summary`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load class insights");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }
  if (!data) return null;

  const total = data.enrolled_count;
  const hasData = data.activities.length > 0;

  if (!hasData) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
        No journal marks recorded for this section yet. Use the <strong>Mark work</strong> tab to
        start assessing students.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-700" />
          <h2 className="text-sm font-semibold text-slate-900">Per-activity mastery</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Distribution of the {total} enrolled students across the ladder for each recorded activity.
        </p>
        <div className="mt-4 space-y-4">
          {data.activities.map((a) => (
            <div key={a.activity_id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-800">
                  {a.quest_code ? <span className="text-slate-400">{a.quest_code} · </span> : null}
                  {a.title}
                </p>
                <span className="shrink-0 text-xs text-slate-400">
                  {a.assessed}/{total} assessed
                </span>
              </div>
              {a.chapter_title && (
                <p className="text-xs text-slate-400">
                  {a.subject_name ? `${a.subject_name} · ` : ""}
                  {a.chapter_title}
                </p>
              )}
              <div className="mt-1.5">
                <LevelDistribution counts={a} total={total} />
              </div>
              <LevelCountRowLabels row={a} />
            </div>
          ))}
        </div>
      </div>

      {data.mandates.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">CBSE mandate coverage</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Each student&apos;s best level across activities tagged to the mandate.
          </p>
          <div className="mt-4 space-y-3">
            {data.mandates.map((m) => (
              <div key={`${m.grade}-${m.code}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm text-slate-800">
                    <span className="font-bold text-teal-800">{m.code}</span> · {m.handbook_item}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {m.students_assessed}/{total}
                  </span>
                </div>
                <div className="mt-1.5">
                  <LevelDistribution counts={m} total={total} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.subjects.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">Subject rollup</h2>
          </div>
          <div className="mt-4 space-y-3">
            {data.subjects.map((s) => (
              <div key={s.subject_id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{s.subject_name}</p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {s.students_assessed}/{total}
                  </span>
                </div>
                <div className="mt-1.5">
                  <LevelDistribution counts={s} total={total} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LevelCountRowLabels({ row }: { row: LevelCountRow }) {
  return (
    <div className="mt-1 flex flex-wrap gap-3">
      {JOURNAL_LEVELS.map((lvl) => (
        <span key={lvl} className="text-[11px] text-slate-500">
          <span className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${JOURNAL_LEVEL_META[lvl].barClass}`} />
          {JOURNAL_LEVEL_META[lvl].short}: {row[lvl]}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student insights tab
// ---------------------------------------------------------------------------

type SectionStudent = {
  user_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  assigned_to_this_section: boolean;
};

type StudentJournal = {
  student: { user_id: string; display_name: string | null; email: string; username: string | null };
  overall: LevelCountRow & { assessed: number };
  subjects: (LevelCountRow & { subject_id: number; subject_name: string; assessed: number })[];
  mandates: { grade: number; code: string; handbook_item: string; unit: string | null; best_rank: number }[];
  timeline: {
    activity_id: number;
    title: string;
    quest_code: string | null;
    level: string | null;
    remark: string | null;
    assessed_at: string | null;
    updated_at: string;
    chapter_title: string | null;
    subject_name: string | null;
    grade: number | null;
    section_name: string | null;
    academic_year_label: string | null;
  }[];
};

const RANK_TO_LEVEL: Record<number, JournalLevel | null> = {
  0: null,
  1: "got_answer",
  2: "got_rule",
  3: "able_to_teach",
};

function StudentInsightsTab({ sectionId }: { sectionId: number }) {
  const [studentId, setStudentId] = useState<string | null>(null);

  const { data: studentsData, isLoading: studentsLoading } = useQuery<{ students: SectionStudent[] }>({
    queryKey: ["/api/sections/students", sectionId],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/students`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load students");
      return res.json();
    },
  });

  const enrolled = useMemo(
    () => (studentsData?.students ?? []).filter((s) => s.assigned_to_this_section),
    [studentsData],
  );

  useEffect(() => {
    setStudentId(null);
  }, [sectionId]);

  const journalQuery = useQuery<StudentJournal>({
    queryKey: ["/api/students/journal", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/students/${studentId}/journal`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load student journal");
      return res.json();
    },
    enabled: !!studentId,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Student</span>
          {studentsLoading ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-teal-700" /> Loading students…
            </div>
          ) : enrolled.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">No students enrolled in this section.</p>
          ) : (
            <select
              value={studentId ?? ""}
              onChange={(e) => setStudentId(e.target.value || null)}
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="">Select a student…</option>
              {enrolled.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.display_name?.trim() || s.email}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {studentId == null ? (
        <p className="text-sm text-slate-500">Pick a student to see their progress.</p>
      ) : journalQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        </div>
      ) : !journalQuery.data ? null : (
        <StudentJournalView data={journalQuery.data} />
      )}
    </div>
  );
}

function StudentJournalView({ data }: { data: StudentJournal }) {
  const name = data.student.display_name?.trim() || data.student.email;
  const o = data.overall;
  const assessedTotal = o.assessed || 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <UserAvatar name={name} size="md" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">{name}</h2>
            <p className="text-xs text-slate-500">{assessedTotal} activities assessed</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {JOURNAL_LEVELS.map((lvl) => {
            const meta = JOURNAL_LEVEL_META[lvl];
            return (
              <div key={lvl} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center">
                <p className={`text-2xl font-bold ${
                  lvl === "got_answer" ? "text-amber-600" : lvl === "got_rule" ? "text-sky-600" : "text-teal-600"
                }`}>
                  {o[lvl]}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{meta.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {data.subjects.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">By subject</h3>
          <div className="mt-4 space-y-3">
            {data.subjects.map((s) => (
              <div key={s.subject_id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{s.subject_name}</p>
                  <span className="text-xs text-slate-400">{s.assessed} assessed</span>
                </div>
                <div className="mt-1.5">
                  <LevelDistribution counts={s} total={s.assessed} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.mandates.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            <h3 className="text-sm font-semibold text-slate-900">CBSE mandate mastery</h3>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.mandates.map((m) => {
              const lvl = RANK_TO_LEVEL[m.best_rank] ?? null;
              const meta = lvl ? JOURNAL_LEVEL_META[lvl] : null;
              return (
                <span
                  key={`${m.grade}-${m.code}`}
                  title={`${m.handbook_item}${m.unit ? ` · ${m.unit}` : ""} — ${meta?.label ?? "Not assessed"}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    meta ? meta.badgeClass : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
                  }`}
                >
                  <span className="font-bold">{m.code}</span>
                  {meta ? `· ${meta.short}` : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {data.timeline.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
          <ul className="mt-4 space-y-3">
            {data.timeline.map((t, i) => {
              const lvl = isJournalLevel(t.level) ? t.level : null;
              const meta = lvl ? JOURNAL_LEVEL_META[lvl] : null;
              return (
                <li key={`${t.activity_id}-${i}`} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta ? meta.barClass : "bg-slate-300"}`} />
                    {i < data.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {t.quest_code ? <span className="text-slate-400">{t.quest_code} · </span> : null}
                        {t.title}
                      </p>
                      {meta && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {[t.subject_name, t.chapter_title, t.section_name, t.academic_year_label]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {t.remark && (
                      <p className="mt-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                        “{t.remark}”
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
