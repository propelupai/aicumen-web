"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  ClipboardList,
  Clock,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  JournalRosterEditor,
  LevelDistribution,
} from "@/components/journal-roster-editor";
import { StudentJournalView, type StudentJournal } from "@/components/student-journal-view";
import { JOURNAL_LEVELS, JOURNAL_LEVEL_META } from "@/lib/journal";

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
  const initialTab = ((): JournalTab => {
    const t = searchParams.get("tab");
    return t === "class" || t === "student" || t === "mark" ? t : "mark";
  })();
  const [sectionId, setSectionId] = useState<number | null>(initialSectionId);
  const [tab, setTab] = useState<JournalTab>(initialTab);

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
  completed_at?: string | null;
  updated_at?: string;
};

function formatRelative(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return "today";
  if (diffMs < 2 * day) return "yesterday";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function MarkTab({
  sectionId,
  initialActivityId,
}: {
  sectionId: number;
  initialActivityId?: number | null;
}) {
  const [activityId, setActivityId] = useState<number | null>(initialActivityId ?? null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

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

  const activities = useMemo(() => recorded?.items ?? [], [recorded]);

  const prevSectionRef = useRef(sectionId);
  useEffect(() => {
    if (prevSectionRef.current === sectionId) return;
    prevSectionRef.current = sectionId;
    setActivityId(null);
    setSearch("");
    setSubjectFilter(null);
  }, [sectionId]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const a of activities) if (a.subject_name) set.add(a.subject_name);
    return Array.from(set).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (subjectFilter && a.subject_name !== subjectFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.quest_code ?? "").toLowerCase().includes(q) ||
        (a.chapter_title ?? "").toLowerCase().includes(q) ||
        (a.subject_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [activities, search, subjectFilter]);

  const selected = activities.find((a) => a.id === activityId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">Activity to mark</span>
          {selected && (
            <button
              type="button"
              onClick={() => setActivityId(null)}
              className="text-xs font-medium text-teal-700 hover:text-teal-900"
            >
              Change activity
            </button>
          )}
        </div>

        {recordedLoading ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-teal-700" /> Loading activities…
          </div>
        ) : activities.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">
            No activities have been run with this section yet. Run a live session first, then come
            back to mark it.
          </p>
        ) : selected ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3">
            <Check className="h-4 w-4 shrink-0 text-teal-700" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {selected.quest_code ? (
                  <span className="text-slate-400">{selected.quest_code} · </span>
                ) : null}
                {selected.title}
              </p>
              <p className="truncate text-xs text-slate-500">
                {[selected.subject_name, selected.chapter_title].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by activity, quest code, chapter, or subject…"
                className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            {subjects.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <FilterChip active={subjectFilter === null} onClick={() => setSubjectFilter(null)}>
                  All subjects
                </FilterChip>
                {subjects.map((s) => (
                  <FilterChip
                    key={s}
                    active={subjectFilter === s}
                    onClick={() => setSubjectFilter(subjectFilter === s ? null : s)}
                  >
                    {s}
                  </FilterChip>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500">No activities match your filters.</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {filtered.map((a, i) => {
                  const when = formatRelative(a.completed_at ?? a.updated_at);
                  const isLatest = i === 0 && !search && !subjectFilter;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setActivityId(a.id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {a.quest_code ? (
                              <span className="text-slate-400">{a.quest_code} · </span>
                            ) : null}
                            {a.title}
                            {isLatest && (
                              <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                                Latest
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {[a.subject_name, a.chapter_title].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        {when && (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            {when}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {activityId == null ? (
        <p className="text-sm text-slate-500">Pick an activity above to mark the class.</p>
      ) : (
        <JournalRosterEditor sectionId={sectionId} activityId={activityId} />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
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

