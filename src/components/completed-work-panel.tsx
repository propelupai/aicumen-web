"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { ActivityListItem } from "@/lib/activities";
import { QuestCard } from "@/components/quest-card";

type CatalogSubject = {
  id: number;
  slug: string;
  name: string;
};

type CompletedItem = ActivityListItem & {
  progress_status: string;
  completed_at: string | null;
  updated_at: string;
};

type CompletedResponse = {
  items: CompletedItem[];
  total: number;
  filters: {
    status: string;
    subject_id: number | null;
    q: string | null;
  };
};

type HistoryStatus = "completed" | "in_progress" | "all";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type CompletedWorkPanelProps = {
  sectionId: number | null;
  grade: number | null;
  subjects: CatalogSubject[];
  subjectsLoading: boolean;
  ready: boolean;
  onRun: (activityId: number) => void;
};

export function CompletedWorkPanel({
  sectionId,
  grade,
  subjects,
  subjectsLoading,
  ready,
  onRun,
}: CompletedWorkPanelProps) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<HistoryStatus>("completed");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const completedQueryKey = useMemo(
    () => [
      "/api/sections/completed",
      sectionId,
      { subjectId, q: debouncedSearch.trim(), status: statusFilter },
    ],
    [sectionId, subjectId, debouncedSearch, statusFilter],
  );

  const { data, isLoading, isError } = useQuery<CompletedResponse>({
    queryKey: completedQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter });
      if (subjectId) params.set("subject_id", String(subjectId));
      const q = debouncedSearch.trim();
      if (q) params.set("q", q);
      const res = await fetch(`/api/sections/${sectionId}/completed?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load completed work");
      return res.json();
    },
    enabled: !!sectionId,
  });

  const items = data?.items ?? [];
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
            Class history
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Quests you&apos;ve run or marked complete for this section — filter by subject, status,
            or search.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <span className="text-xs font-semibold text-slate-600">Status</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { value: "completed" as const, label: "Completed" },
                  { value: "in_progress" as const, label: "In progress" },
                  { value: "all" as const, label: "All recorded" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    statusFilter === opt.value
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-600">Lesson subject</span>
            {subjectsLoading ? (
              <div className="mt-2 flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSubjectId(null)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    subjectId === null
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All subjects
                </button>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubjectId(s.id)}
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

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">
              Search quests{grade ? ` · Grade ${grade}` : ""}
            </span>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Quest title, chapter, theme, or activity type"
                className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </label>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              {statusFilter === "completed"
                ? "Completed quests"
                : statusFilter === "in_progress"
                  ? "In-progress quests"
                  : "Recorded quests"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {isLoading
                ? "Loading…"
                : `${items.length} quest${items.length === 1 ? "" : "s"}`}
              {selectedSubject ? ` · ${selectedSubject.name}` : ""}
              {debouncedSearch.trim() ? ` · “${debouncedSearch.trim()}”` : ""}
            </p>
          </div>
        </div>

        {!sectionId ? (
          <p className="mt-4 text-sm text-slate-500">
            Select a class section above to view completed work.
          </p>
        ) : isLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : isError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load class history. Please try again.
          </p>
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            {statusFilter === "completed"
              ? "No completed quests yet for this section."
              : statusFilter === "in_progress"
                ? "No quests in progress — start a live session from Find quests."
                : "No recorded quest activity yet. Run a quest live and mark it complete at the end of class."}
            {debouncedSearch.trim() || subjectId
              ? " Try clearing filters or switching status."
              : ""}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((activity) => (
              <QuestCard
                key={activity.id}
                activity={activity}
                disabled={!ready}
                runLabel={ready ? "Run again →" : "Soon"}
                completedAt={activity.completed_at}
                progressStatus={activity.progress_status}
                onRun={() => onRun(activity.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
