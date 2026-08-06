"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { AI_PROGRAM_SLUG, CT_PROGRAM_SLUG, type ProgramTrack } from "@/lib/subjects";
import type { SchoolPreferences } from "@/lib/school-overlays";

type ActivityNode = {
  id: number;
  title: string;
  is_enabled: boolean;
  effective_sort: number;
};

type ChapterNode = {
  id: number;
  chapter_code: string;
  title: string;
  grade: number;
  is_enabled: boolean;
  activity_count: number;
  enabled_activity_count: number;
  activities: ActivityNode[];
};

type SubjectNode = {
  id: number;
  slug: string;
  name: string;
  kind: string;
  is_enabled: boolean;
  chapter_count: number;
  enabled_chapter_count: number;
  chapters: ChapterNode[];
};

type CurationResponse = {
  preferences: SchoolPreferences;
  tree: SubjectNode[];
};

function subjectProgram(slug: string): ProgramTrack {
  return slug === AI_PROGRAM_SLUG ? "ai" : "ct";
}

function subjectRoleLabel(slug: string, kind: string): string {
  if (slug === AI_PROGRAM_SLUG) return "AI modules";
  if (slug === CT_PROGRAM_SLUG) return "CT level bank (not a lesson subject)";
  if (kind === "cbse_anchor" || !kind) return "Lesson subject (CT)";
  return kind.replaceAll("_", " ");
}

function EnableToggle({
  enabled,
  onToggle,
  muted,
}: {
  enabled: boolean;
  onToggle: () => void;
  /** Parent is off — own setting still shown, but teachers will not see this item. */
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={
        muted
          ? "Hidden because a parent is Off. Turn the parent On for this setting to matter."
          : enabled
            ? "Visible to teachers"
            : "Hidden from teachers"
      }
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
        muted
          ? "bg-slate-50 text-slate-400 ring-1 ring-slate-200"
          : enabled
            ? "bg-teal-100 text-teal-800"
            : "bg-slate-100 text-slate-500"
      }`}
    >
      {enabled && !muted ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {muted ? "Hidden" : enabled ? "On" : "Off"}
    </button>
  );
}

function useDragReorder(ids: number[], onReorder: (orderedIds: number[]) => void) {
  const [dragId, setDragId] = useState<number | null>(null);

  const onDragStart = useCallback((id: number) => {
    setDragId(id);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback(
    (targetId: number) => {
      if (dragId == null || dragId === targetId) {
        setDragId(null);
        return;
      }
      const next = [...ids];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) {
        setDragId(null);
        return;
      }
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      setDragId(null);
      onReorder(next);
    },
    [dragId, ids, onReorder],
  );

  const onDragEnd = useCallback(() => setDragId(null), []);

  return { dragId, onDragStart, onDragOver, onDrop, onDragEnd };
}

function reorderByIds<T extends { id: number }>(items: T[], orderedIds: number[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const next: T[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) next.push(item);
  }
  for (const item of items) {
    if (!orderedIds.includes(item.id)) next.push(item);
  }
  return next;
}

/** School curriculum customization: programs + drag-reorder tree (active school). */
export function SchoolCustomizePanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [gradeFilter, setGradeFilter] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const didInitialExpand = useRef(false);

  const schoolId = user?.school_id ?? null;
  const url = gradeFilter
    ? `/api/school/content?grade=${gradeFilter}`
    : "/api/school/content";
  const queryKey = [url, schoolId] as const;

  const { data, isLoading, isError, error, refetch } = useQuery<CurationResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load curriculum");
      return res.json();
    },
    enabled: schoolId != null,
  });

  const patchCache = useCallback(
    (updater: (prev: CurationResponse) => CurationResponse) => {
      queryClient.setQueryData<CurationResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        return updater(prev);
      });
    },
    [queryClient, queryKey],
  );

  const prefsMutation = useMutation({
    mutationFn: async (patch: Partial<SchoolPreferences>) => {
      const res = await fetch("/api/school/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json() as Promise<SchoolPreferences>;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CurationResponse>(queryKey);
      patchCache((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, ...patch },
      }));
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSuccess: (prefs) => {
      patchCache((prev) => ({ ...prev, preferences: prefs }));
    },
  });

  const subjectMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      const res = await fetch(`/api/school/content/subjects/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onMutate: async ({ id, is_enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CurationResponse>(queryKey);
      patchCache((prev) => ({
        ...prev,
        tree: prev.tree.map((s) => (s.id === id ? { ...s, is_enabled } : s)),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const chapterMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      const res = await fetch(`/api/school/content/chapters/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onMutate: async ({ id, is_enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CurationResponse>(queryKey);
      patchCache((prev) => ({
        ...prev,
        tree: prev.tree.map((s) => ({
          ...s,
          chapters: s.chapters.map((c) => (c.id === id ? { ...c, is_enabled } : c)),
        })),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const activityMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      const res = await fetch(`/api/school/content/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onMutate: async ({ id, is_enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CurationResponse>(queryKey);
      patchCache((prev) => ({
        ...prev,
        tree: prev.tree.map((s) => ({
          ...s,
          chapters: s.chapters.map((c) => ({
            ...c,
            activities: c.activities.map((a) =>
              a.id === id ? { ...a, is_enabled } : a,
            ),
          })),
        })),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      scope,
      ordered_ids,
    }: {
      scope: "subjects" | "chapters" | "activities";
      ordered_ids: number[];
    }) => {
      const res = await fetch("/api/school/content/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, ordered_ids }),
      });
      if (!res.ok) throw new Error("Reorder failed");
    },
    onMutate: async ({ scope, ordered_ids }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CurationResponse>(queryKey);
      patchCache((prev) => {
        if (scope === "subjects") {
          return { ...prev, tree: reorderByIds(prev.tree, ordered_ids) };
        }
        if (scope === "chapters") {
          return {
            ...prev,
            tree: prev.tree.map((s) => {
              const overlap = s.chapters.some((c) => ordered_ids.includes(c.id));
              if (!overlap) return s;
              return { ...s, chapters: reorderByIds(s.chapters, ordered_ids) };
            }),
          };
        }
        return {
          ...prev,
          tree: prev.tree.map((s) => ({
            ...s,
            chapters: s.chapters.map((c) => {
              const overlap = c.activities.some((a) => ordered_ids.includes(a.id));
              if (!overlap) return c;
              return { ...c, activities: reorderByIds(c.activities, ordered_ids) };
            }),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const tree = data?.tree ?? [];
  const prefs = data?.preferences;

  useEffect(() => {
    didInitialExpand.current = false;
  }, [schoolId, gradeFilter]);

  useEffect(() => {
    if (didInitialExpand.current || tree.length === 0) return;
    didInitialExpand.current = true;
    // Expand first lesson subject once for discoverability; user can collapse all after.
    const firstLesson =
      tree.find((s) => s.slug !== CT_PROGRAM_SLUG && s.slug !== AI_PROGRAM_SLUG) ?? tree[0];
    setExpandedSubjects(new Set([firstLesson.id]));
  }, [tree]);

  const ctSubjects = useMemo(
    () =>
      tree.filter(
        (s) => subjectProgram(s.slug) === "ct" && s.slug !== CT_PROGRAM_SLUG,
      ),
    [tree],
  );
  const aiSubjects = useMemo(
    () => tree.filter((s) => subjectProgram(s.slug) === "ai"),
    [tree],
  );

  function toggleSubjectExpand(id: number) {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleChapterExpand(id: number) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (schoolId == null) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm text-amber-900">
        No school selected yet. Pick a school to customize what its teachers see.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="text-sm font-medium text-red-900">
          {(error as Error)?.message ?? "Failed to load curriculum"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-teal-100 bg-teal-50/50 px-5 py-4 text-sm text-teal-950">
        Changes only affect teachers at{" "}
        <strong>{user?.school_name ?? "this school"}</strong>. Turning something Off hides it for
        them. On/Off cascades: a subject Off hides its modules and quests even if those say On.
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
          Programs
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Which dashboard tabs teachers can open. The tree below is grouped the same way.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition-colors ${
              prefs?.programs_ct_enabled
                ? "border-teal-300 bg-teal-50/40"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={prefs?.programs_ct_enabled ?? true}
              onChange={(e) =>
                prefsMutation.mutate({ programs_ct_enabled: e.target.checked })
              }
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-teal-700" />
                Computational Thinking
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Lesson subjects (English, Maths, …) on the CT dashboard tab
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition-colors ${
              prefs?.programs_ai_enabled
                ? "border-teal-300 bg-teal-50/40"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={prefs?.programs_ai_enabled ?? true}
              onChange={(e) =>
                prefsMutation.mutate({ programs_ai_enabled: e.target.checked })
              }
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Brain className="h-4 w-4 text-teal-700" />
                Artificial Intelligence
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                AI Literacy modules on the AI dashboard tab (grades 6–8)
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4">
          <span className="text-xs font-semibold text-slate-600">Default program for teachers</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["ct", "ai"] as ProgramTrack[]).map((track) => {
              const disabled =
                (track === "ct" && prefs?.programs_ct_enabled === false) ||
                (track === "ai" && prefs?.programs_ai_enabled === false);
              const selected = prefs?.default_program_track === track;
              return (
                <button
                  key={track}
                  type="button"
                  disabled={disabled}
                  onClick={() => prefsMutation.mutate({ default_program_track: track })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-teal-700 text-white"
                      : disabled
                        ? "cursor-not-allowed bg-slate-50 text-slate-300"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {track === "ct" ? "Computational Thinking" : "Artificial Intelligence"}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              Curriculum tree
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Drag to reorder. Off hides that item (and everything under it) from teachers.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Grade
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              {[3, 4, 5, 6, 7, 8].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 space-y-6">
          <ProgramTreeGroup
            title="Computational Thinking"
            subtitle="Lesson subjects on the CT dashboard tab (English, Maths, Science, Social Studies)."
            icon={<Sparkles className="h-4 w-4 text-teal-700" />}
            programEnabled={prefs?.programs_ct_enabled !== false}
            subjects={ctSubjects}
            emptyLabel={`No CT subjects with published content${gradeFilter ? ` for grade ${gradeFilter}` : ""}.`}
            expandedSubjects={expandedSubjects}
            expandedChapters={expandedChapters}
            onToggleSubjectExpand={toggleSubjectExpand}
            onToggleChapterExpand={toggleChapterExpand}
            onToggleSubject={(id, is_enabled) => subjectMutation.mutate({ id, is_enabled })}
            onToggleChapter={(id, is_enabled) => chapterMutation.mutate({ id, is_enabled })}
            onToggleActivity={(id, is_enabled) => activityMutation.mutate({ id, is_enabled })}
            onReorderSubjects={(ordered_ids) =>
              reorderMutation.mutate({ scope: "subjects", ordered_ids })
            }
            onReorderChapters={(ordered_ids) =>
              reorderMutation.mutate({ scope: "chapters", ordered_ids })
            }
            onReorderActivities={(ordered_ids) =>
              reorderMutation.mutate({ scope: "activities", ordered_ids })
            }
          />

          <ProgramTreeGroup
            title="Artificial Intelligence"
            subtitle="AI Literacy modules: same tree teachers see on the AI tab."
            icon={<Brain className="h-4 w-4 text-teal-700" />}
            programEnabled={prefs?.programs_ai_enabled !== false}
            subjects={aiSubjects}
            emptyLabel={`No AI modules with published content${gradeFilter ? ` for grade ${gradeFilter}` : ""}.`}
            expandedSubjects={expandedSubjects}
            expandedChapters={expandedChapters}
            onToggleSubjectExpand={toggleSubjectExpand}
            onToggleChapterExpand={toggleChapterExpand}
            onToggleSubject={(id, is_enabled) => subjectMutation.mutate({ id, is_enabled })}
            onToggleChapter={(id, is_enabled) => chapterMutation.mutate({ id, is_enabled })}
            onToggleActivity={(id, is_enabled) => activityMutation.mutate({ id, is_enabled })}
            onReorderSubjects={(ordered_ids) =>
              reorderMutation.mutate({ scope: "subjects", ordered_ids })
            }
            onReorderChapters={(ordered_ids) =>
              reorderMutation.mutate({ scope: "chapters", ordered_ids })
            }
            onReorderActivities={(ordered_ids) =>
              reorderMutation.mutate({ scope: "activities", ordered_ids })
            }
          />
        </div>
      </section>
    </div>
  );
}

function ProgramTreeGroup({
  title,
  subtitle,
  icon,
  programEnabled,
  subjects,
  emptyLabel,
  expandedSubjects,
  expandedChapters,
  onToggleSubjectExpand,
  onToggleChapterExpand,
  onToggleSubject,
  onToggleChapter,
  onToggleActivity,
  onReorderSubjects,
  onReorderChapters,
  onReorderActivities,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  programEnabled: boolean;
  subjects: SubjectNode[];
  emptyLabel: string;
  expandedSubjects: Set<number>;
  expandedChapters: Set<number>;
  onToggleSubjectExpand: (id: number) => void;
  onToggleChapterExpand: (id: number) => void;
  onToggleSubject: (id: number, is_enabled: boolean) => void;
  onToggleChapter: (id: number, is_enabled: boolean) => void;
  onToggleActivity: (id: number, is_enabled: boolean) => void;
  onReorderSubjects: (ids: number[]) => void;
  onReorderChapters: (ids: number[]) => void;
  onReorderActivities: (ids: number[]) => void;
}) {
  const ids = useMemo(() => subjects.map((s) => s.id), [subjects]);
  const drag = useDragReorder(ids, onReorderSubjects);

  return (
    <div className={programEnabled ? "" : "opacity-55"}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {icon}
            {title}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        {!programEnabled && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
            Program off: hidden on dashboard
          </span>
        )}
      </div>

      {subjects.length === 0 ? (
        <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2">
          {subjects.map((subject) => {
            const open = expandedSubjects.has(subject.id);
            const subjectMuted = !programEnabled;
            return (
              <div
                key={subject.id}
                draggable
                onDragStart={() => drag.onDragStart(subject.id)}
                onDragOver={drag.onDragOver}
                onDrop={() => drag.onDrop(subject.id)}
                onDragEnd={drag.onDragEnd}
                className={`rounded-xl border ${
                  drag.dragId === subject.id
                    ? "border-teal-300 bg-teal-50/50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="cursor-grab text-slate-300 active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleSubjectExpand(subject.id)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={open ? "Collapse" : "Expand"}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {subject.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {subject.enabled_chapter_count}/{subject.chapter_count} modules on ·{" "}
                      {subjectRoleLabel(subject.slug, subject.kind)}
                    </p>
                  </div>
                  <EnableToggle
                    enabled={subject.is_enabled}
                    muted={subjectMuted}
                    onToggle={() => onToggleSubject(subject.id, !subject.is_enabled)}
                  />
                </div>

                {open && (
                  <ChapterList
                    chapters={subject.chapters}
                    parentEnabled={programEnabled && subject.is_enabled}
                    expandedChapters={expandedChapters}
                    onToggleChapter={onToggleChapterExpand}
                    onToggleChapterEnabled={(id, is_enabled) => onToggleChapter(id, is_enabled)}
                    onToggleActivityEnabled={(id, is_enabled) => onToggleActivity(id, is_enabled)}
                    onReorderChapters={onReorderChapters}
                    onReorderActivities={onReorderActivities}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChapterList({
  chapters,
  parentEnabled,
  expandedChapters,
  onToggleChapter,
  onToggleChapterEnabled,
  onToggleActivityEnabled,
  onReorderChapters,
  onReorderActivities,
}: {
  chapters: ChapterNode[];
  parentEnabled: boolean;
  expandedChapters: Set<number>;
  onToggleChapter: (id: number) => void;
  onToggleChapterEnabled: (id: number, is_enabled: boolean) => void;
  onToggleActivityEnabled: (id: number, is_enabled: boolean) => void;
  onReorderChapters: (ids: number[]) => void;
  onReorderActivities: (ids: number[]) => void;
}) {
  const ids = useMemo(() => chapters.map((c) => c.id), [chapters]);
  const drag = useDragReorder(ids, onReorderChapters);

  if (chapters.length === 0) {
    return (
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
        No modules/chapters in this filter.
      </p>
    );
  }

  return (
    <div className="space-y-1 border-t border-slate-100 bg-slate-50/50 px-2 py-2">
      {chapters.map((chapter) => {
        const open = expandedChapters.has(chapter.id);
        const muted = !parentEnabled;
        return (
          <div
            key={chapter.id}
            draggable
            onDragStart={() => drag.onDragStart(chapter.id)}
            onDragOver={drag.onDragOver}
            onDrop={() => drag.onDrop(chapter.id)}
            onDragEnd={drag.onDragEnd}
            className={`rounded-lg border bg-white ${
              drag.dragId === chapter.id ? "border-teal-300" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 px-2 py-2">
              <span className="cursor-grab text-slate-300">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <button
                type="button"
                onClick={() => onToggleChapter(chapter.id)}
                className="text-slate-400"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">
                  {chapter.chapter_code} · {chapter.title}
                </p>
                <p className="text-[11px] text-slate-400">
                  Grade {chapter.grade} · {chapter.enabled_activity_count}/
                  {chapter.activity_count} activities on
                </p>
              </div>
              <EnableToggle
                enabled={chapter.is_enabled}
                muted={muted}
                onToggle={() => onToggleChapterEnabled(chapter.id, !chapter.is_enabled)}
              />
            </div>

            {open && (
              <ActivityList
                activities={chapter.activities}
                parentEnabled={parentEnabled && chapter.is_enabled}
                onToggle={onToggleActivityEnabled}
                onReorder={onReorderActivities}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivityList({
  activities,
  parentEnabled,
  onToggle,
  onReorder,
}: {
  activities: ActivityNode[];
  parentEnabled: boolean;
  onToggle: (id: number, is_enabled: boolean) => void;
  onReorder: (ids: number[]) => void;
}) {
  const ids = useMemo(() => activities.map((a) => a.id), [activities]);
  const drag = useDragReorder(ids, onReorder);

  if (activities.length === 0) {
    return (
      <p className="border-t border-slate-50 px-3 py-2 text-[11px] text-slate-400">
        No published activities.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 border-t border-slate-100 bg-slate-50/80 px-1.5 py-1.5">
      {activities.map((activity) => (
        <li
          key={activity.id}
          draggable
          onDragStart={() => drag.onDragStart(activity.id)}
          onDragOver={drag.onDragOver}
          onDrop={() => drag.onDrop(activity.id)}
          onDragEnd={drag.onDragEnd}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
            drag.dragId === activity.id ? "bg-teal-50" : "bg-white"
          }`}
        >
          <span className="cursor-grab text-slate-300">
            <GripVertical className="h-3 w-3" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
            {activity.title}
          </span>
          <EnableToggle
            enabled={activity.is_enabled}
            muted={!parentEnabled}
            onToggle={() => onToggle(activity.id, !activity.is_enabled)}
          />
        </li>
      ))}
    </ul>
  );
}
