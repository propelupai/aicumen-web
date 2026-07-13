"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { QuestCard } from "@/components/quest-card";
import { CompletedWorkPanel } from "@/components/completed-work-panel";
import { firstName, getTimeGreeting } from "@/lib/quest-preview";
import type { ActivityListItem } from "@/lib/activities";
import { Building2, CheckCircle2, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";

type HomeTab = "find" | "history";

type Overview = {
  school_name: string | null;
  academic_year: { id: number; label: string } | null;
  class_count: number;
  section_count: number;
};

type CatalogSubject = {
  id: number;
  slug: string;
  name: string;
  grade_min: number;
  grade_max: number;
  kind: "cbse_anchor";
  has_published_quests: boolean;
};

type CatalogChapter = {
  id: number;
  chapter_code: string;
  title: string;
  grade: number;
  anchor_curriculum: string | null;
  quest_count: number;
};

type CatalogMandate = {
  grade: number;
  code: string;
  handbook_item: string;
  unit: string | null;
  handbook_track: string;
  activity_count: number;
};

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

type ActivitiesResponse = {
  items: ActivityListItem[];
  total: number;
  counts?: { cbse_chapter: number; ct_program: number };
  filters: {
    grade: number | null;
    subject_id: number | null;
    chapter_id: number | null;
    section_id: number | null;
    q: string | null;
  };
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  const displayName = user?.display_name || user?.firebaseUser.email?.split("@")[0] || "there";
  const greeting = getTimeGreeting();
  const name = firstName(displayName);

  const [sectionId, setSectionId] = useState<number | null>(null);
  const [homeTab, setHomeTab] = useState<HomeTab>("find");
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [mandateCode, setMandateCode] = useState<string | null>(null);
  const [topicQuery, setTopicQuery] = useState("");
  const debouncedTopic = useDebouncedValue(topicQuery, 300);

  const { data: overview, isLoading: overviewLoading } = useQuery<Overview>({
    queryKey: ["/api/school/overview"],
    queryFn: async () => {
      const res = await fetch("/api/school/overview", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: teacherSections } = useQuery<TeacherSectionsResponse>({
    queryKey: ["/api/teachers/me/sections"],
    queryFn: async () => {
      const res = await fetch("/api/teachers/me/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
    enabled: !!user,
  });

  const sections = teacherSections?.sections ?? [];
  const selectedSection = sections.find((s) => s.id === sectionId) ?? null;
  const grade = selectedSection?.grade ?? null;

  useEffect(() => {
    if (sectionId || sections.length === 0) return;
    const primary = sections.find((s) => s.is_primary) ?? sections[0];
    setSectionId(primary.id);
  }, [sections, sectionId]);

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<CatalogSubject[]>({
    queryKey: ["/api/catalog/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/catalog/subjects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subjects");
      return res.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (subjectId || subjects.length === 0) return;
    setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  const chapterSearch = debouncedTopic.trim();
  const { data: chapters = [], isLoading: chaptersLoading } = useQuery<CatalogChapter[]>({
    queryKey: ["/api/catalog/chapters", subjectId, grade, chapterSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ subject_id: String(subjectId) });
      if (grade) params.set("grade", String(grade));
      if (chapterSearch) params.set("q", chapterSearch);
      const res = await fetch(`/api/catalog/chapters?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chapters");
      return res.json();
    },
    enabled: !!user && !!subjectId,
  });

  const { data: mandates = [] } = useQuery<CatalogMandate[]>({
    queryKey: ["/api/catalog/mandates", grade],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (grade) params.set("grade", String(grade));
      const res = await fetch(`/api/catalog/mandates?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load mandates");
      return res.json();
    },
    enabled: !!user,
  });

  const activitiesQueryKey = useMemo(
    () => [
      "/api/activities",
      { subjectId, chapterId, grade, sectionId, q: chapterSearch, mandateCode },
    ],
    [subjectId, chapterId, grade, sectionId, chapterSearch, mandateCode],
  );

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    isError: activitiesError,
  } = useQuery<ActivitiesResponse>({
    queryKey: activitiesQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (subjectId) params.set("subject_id", String(subjectId));
      if (chapterId) params.set("chapter_id", String(chapterId));
      if (grade) params.set("grade", String(grade));
      if (sectionId) params.set("section_id", String(sectionId));
      if (chapterSearch) params.set("q", chapterSearch);
      if (mandateCode) params.set("mandate_code", mandateCode);
      const res = await fetch(`/api/activities?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
    enabled: !!user && !!subjectId,
  });

  const activities = activitiesData?.items ?? [];
  const ready = !!overview?.academic_year && (overview?.section_count ?? 0) > 0;
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const selectedChapter = chapters.find((c) => c.id === chapterId);
  const selectedMandate = mandates.find((m) => m.code === mandateCode);

  function handleRun(activityId: number) {
    const params = sectionId ? `?sectionId=${sectionId}` : "";
    router.push(`/dashboard/session/${activityId}${params}`);
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {greeting}, {name}!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          What did you teach in class today? Pick the lesson subject and chapter — we&apos;ll
          surface Socratic CT quests anchored to that lesson.
        </p>
      </section>

      {!overviewLoading && !ready && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-5 py-4 text-sm text-amber-950">
          Complete{" "}
          <Link
            href="/dashboard/school"
            className="font-semibold text-teal-800 underline-offset-2 hover:underline"
          >
            school setup
          </Link>{" "}
          (academic year + sections) before running live sessions with your class.
        </div>
      )}

      {sections.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Class section</span>
            {teacherSections?.source === "assigned" && (
              <span className="ml-2 text-xs font-normal text-slate-400">· your assigned sections</span>
            )}
            <select
              value={sectionId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setSectionId(Number.isInteger(id) ? id : null);
                setChapterId(null);
              }}
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name} · Grade {s.grade}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setHomeTab("find")}
          className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            homeTab === "find"
              ? "border border-b-0 border-slate-200 bg-white text-teal-900"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Find quests
        </button>
        <button
          type="button"
          onClick={() => setHomeTab("history")}
          className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            homeTab === "history"
              ? "border border-b-0 border-slate-200 bg-white text-teal-900"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Completed work
        </button>
      </div>

      {homeTab === "history" ? (
        <CompletedWorkPanel
          sectionId={sectionId}
          grade={grade}
          subjects={subjects}
          subjectsLoading={subjectsLoading}
          ready={ready}
          onRun={handleRun}
        />
      ) : (
        <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              Live class picker
            </p>
            {teacherSections?.source === "assigned" && (
              <p className="mt-1 text-xs text-slate-500">Showing your assigned sections</p>
            )}
          </div>
          <Link
            href="/dashboard/school"
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200/80 bg-teal-50/50 px-4 py-2 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-50"
          >
            <Building2 className="h-4 w-4" />
            School setup
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-slate-600">Lesson subject (CBSE)</span>
              {subjectsLoading ? (
                <div className="mt-2 flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
                </div>
              ) : subjects.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No lesson subjects configured yet. Run migration 005 for Maths, English, Science,
                  and Social Studies.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSubjectId(s.id);
                        setChapterId(null);
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        subjectId === s.id
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">
                Chapter or topic
                {grade ? ` · Grade ${grade}` : ""}
              </span>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={topicQuery}
                  onChange={(e) => {
                    setTopicQuery(e.target.value);
                    setChapterId(null);
                  }}
                  placeholder={
                    selectedSubject
                      ? `e.g. ${selectedSubject.name === "Mathematics" ? "fractions" : "living things"}`
                      : "Search chapter name or topic"
                  }
                  className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </label>

            {chaptersLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
              </div>
            ) : chapters.length > 0 ? (
              <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setChapterId(null)}
                  className={`rounded-lg border px-3 py-1.5 text-left text-xs font-medium ${
                    chapterId === null
                      ? "border-teal-300 bg-teal-50 text-teal-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  All matching chapters
                </button>
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChapterId(ch.id)}
                    className={`rounded-lg border px-3 py-1.5 text-left text-xs font-medium ${
                      chapterId === ch.id
                        ? "border-teal-300 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                    title={ch.anchor_curriculum ?? undefined}
                  >
                    {ch.chapter_code} · {ch.title}
                    <span className="ml-1 text-slate-400">({ch.quest_count})</span>
                  </button>
                ))}
              </div>
            ) : subjectId ? (
              <p className="text-xs text-slate-500">
                No chapters found{chapterSearch ? ` for “${chapterSearch}”` : ""}.
                {grade ? " Try clearing the search or check another subject." : ""}
              </p>
            ) : null}
          </div>
        </div>

        {mandates.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
                CBSE handbook mandate{grade ? ` · Grade ${grade}` : ""}
              </span>
              {mandateCode && (
                <button
                  type="button"
                  onClick={() => setMandateCode(null)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {mandates.map((m) => {
                const selected = mandateCode === m.code;
                return (
                  <button
                    key={`${m.grade}-${m.code}`}
                    type="button"
                    onClick={() => setMandateCode(selected ? null : m.code)}
                    title={`${m.code} · ${m.handbook_item}${m.unit ? ` (${m.unit})` : ""}`}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "border-teal-300 bg-teal-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold">{m.code}</span>
                    <span className={selected ? "text-teal-50" : "text-slate-500"}>
                      {" "}
                      · {m.handbook_item}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              Quests for this lesson
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {activitiesLoading
                ? "Loading…"
                : `${activities.length} quest${activities.length === 1 ? "" : "s"}`}
              {selectedSubject ? ` · ${selectedSubject.name}` : ""}
              {selectedChapter ? ` · ${selectedChapter.title}` : ""}
              {grade && !selectedChapter ? ` · Grade ${grade}` : ""}
              {selectedMandate ? ` · ${selectedMandate.code} ${selectedMandate.handbook_item}` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Quests are Computational Thinking activities mapped to your lesson — not a separate
              timetable subject. Search a chapter or topic to find matches.
            </p>
          </div>
        </div>

        {activitiesLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : activitiesError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load quests. Please try again later or contact your administrator.
          </p>
        ) : activities.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No quests yet for this {selectedSubject?.name ?? "subject"}
            {chapterSearch ? ` and topic “${chapterSearch}”` : ""}
            {grade ? ` (grade ${grade})` : ""}. Try searching a topic — e.g. &quot;pattern&quot; or
            &quot;rangoli&quot; — to find CT quests from the problem bank.
          </p>
        ) : (
          <>
            {(activitiesData?.counts?.ct_program ?? 0) > 0 &&
              (activitiesData?.counts?.cbse_chapter ?? 0) === 0 && (
                <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-900">
                  Showing CT program quests matched to your topic. Integrated-book sparks for{" "}
                  {selectedSubject?.name} will appear here once those chapters are ingested.
                </p>
              )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {activities.map((activity) => (
                <QuestCard
                  key={activity.id}
                  activity={activity}
                  disabled={!ready}
                  onRun={() => handleRun(activity.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>
        </>
      )}
    </div>
  );
}
