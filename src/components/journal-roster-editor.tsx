"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useToast } from "@/hooks/use-toast";
import {
  JOURNAL_LEVELS,
  JOURNAL_LEVEL_META,
  type JournalLevel,
  isJournalLevel,
} from "@/lib/journal";

type RosterEntry = {
  student_user_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  level: string | null;
  remark: string | null;
  assessed_at: string | null;
};

type JournalPayload = {
  section: { section_id: number; display_name: string; class_name: string; grade: number };
  activity: { activity_id: number; title: string; quest_code: string | null };
  roster: RosterEntry[];
};

type LocalMark = { level: JournalLevel | null; remark: string };

/** Stacked distribution bar for level counts. */
export function LevelDistribution({
  counts,
  total,
}: {
  counts: { got_answer: number; got_rule: number; able_to_teach: number };
  total: number;
}) {
  const assessed = counts.got_answer + counts.got_rule + counts.able_to_teach;
  const notAssessed = Math.max(0, total - assessed);
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {JOURNAL_LEVELS.map((lvl) => {
        const n = counts[lvl];
        if (n <= 0) return null;
        return (
          <div
            key={lvl}
            className={JOURNAL_LEVEL_META[lvl].barClass}
            style={{ width: `${pct(n)}%` }}
            title={`${JOURNAL_LEVEL_META[lvl].label}: ${n}`}
          />
        );
      })}
      {notAssessed > 0 && (
        <div
          className="bg-slate-200"
          style={{ width: `${pct(notAssessed)}%` }}
          title={`Not assessed: ${notAssessed}`}
        />
      )}
    </div>
  );
}

/**
 * Roster marking grid for one section + activity.
 * Bulk "mark all" buttons, per-student level pills, per-student remarks, single save.
 * Used by the Journal page and the in-session slide-over.
 */
export function JournalRosterEditor({
  sectionId,
  activityId,
  onSaved,
  className = "",
}: {
  sectionId: number;
  activityId: number;
  onSaved?: () => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [marks, setMarks] = useState<Record<string, LocalMark>>({});
  const [expandedRemarks, setExpandedRemarks] = useState<Set<string>>(new Set());

  const journalQuery = useQuery<JournalPayload>({
    queryKey: ["/api/sections/journal", sectionId, activityId],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/journal?activity_id=${activityId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load journal");
      return res.json();
    },
    enabled: Number.isInteger(sectionId) && Number.isInteger(activityId),
  });

  const serverMarks = useMemo(() => {
    const map: Record<string, LocalMark> = {};
    for (const r of journalQuery.data?.roster ?? []) {
      map[r.student_user_id] = {
        level: isJournalLevel(r.level) ? r.level : null,
        remark: r.remark ?? "",
      };
    }
    return map;
  }, [journalQuery.data]);

  useEffect(() => {
    if (journalQuery.data) setMarks(serverMarks);
  }, [serverMarks, journalQuery.data]);

  const roster = journalQuery.data?.roster ?? [];

  const dirty = useMemo(() => {
    const ids = new Set([...Object.keys(marks), ...Object.keys(serverMarks)]);
    for (const idv of ids) {
      const a = marks[idv] ?? { level: null, remark: "" };
      const b = serverMarks[idv] ?? { level: null, remark: "" };
      if (a.level !== b.level || a.remark.trim() !== b.remark.trim()) return true;
    }
    return false;
  }, [marks, serverMarks]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = roster.map((r) => {
        const m = marks[r.student_user_id] ?? { level: null, remark: "" };
        return {
          student_user_id: r.student_user_id,
          level: m.level,
          remark: m.remark.trim() || null,
        };
      });
      const res = await fetch(`/api/sections/${sectionId}/journal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ activity_id: activityId, entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to save journal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections/journal", sectionId, activityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sections/journal-summary", sectionId] });
      toast({ title: "Journal saved" });
      onSaved?.();
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  function setLevel(studentId: string, level: JournalLevel) {
    setMarks((prev) => {
      const cur = prev[studentId] ?? { level: null, remark: "" };
      return { ...prev, [studentId]: { ...cur, level: cur.level === level ? null : level } };
    });
  }

  function setRemark(studentId: string, remark: string) {
    setMarks((prev) => {
      const cur = prev[studentId] ?? { level: null, remark: "" };
      return { ...prev, [studentId]: { ...cur, remark } };
    });
  }

  function markAll(level: JournalLevel) {
    setMarks((prev) => {
      const next = { ...prev };
      for (const r of roster) {
        const cur = next[r.student_user_id] ?? { level: null, remark: "" };
        next[r.student_user_id] = { ...cur, level };
      }
      return next;
    });
  }

  function toggleRemark(studentId: string) {
    setExpandedRemarks((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  const liveCounts = useMemo(() => {
    const c = { got_answer: 0, got_rule: 0, able_to_teach: 0 };
    for (const r of roster) {
      const lvl = marks[r.student_user_id]?.level;
      if (lvl) c[lvl] += 1;
    }
    return c;
  }, [marks, roster]);

  if (journalQuery.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No students are enrolled in this section yet. Add students from the School page.
      </p>
    );
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {journalQuery.data?.activity.title}
          </p>
          <p className="text-xs text-slate-500">{roster.length} students</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Mark all as:</span>
          {JOURNAL_LEVELS.map((lvl) => {
            const meta = JOURNAL_LEVEL_META[lvl];
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => markAll(lvl)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors ${meta.barClass} hover:opacity-90`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <LevelDistribution counts={liveCounts} total={roster.length} />
      </div>

      <ul className="divide-y divide-slate-100">
        {roster.map((r) => {
          const name = r.display_name?.trim() || r.email;
          const local = marks[r.student_user_id] ?? { level: null, remark: "" };
          const remarkOpen = expandedRemarks.has(r.student_user_id) || local.remark.length > 0;
          return (
            <li key={r.student_user_id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.username ? `@${r.username}` : r.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {JOURNAL_LEVELS.map((lvl) => {
                    const meta = JOURNAL_LEVEL_META[lvl];
                    const active = local.level === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLevel(r.student_user_id, lvl)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                          active ? meta.selectedClass : `bg-white ${meta.idleClass}`
                        }`}
                      >
                        {meta.short}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => toggleRemark(r.student_user_id)}
                    title="Add remark"
                    className={`ml-1 rounded-full p-2 ring-1 transition-colors ${
                      local.remark
                        ? "bg-slate-800 text-white ring-slate-800"
                        : "bg-white text-slate-400 ring-slate-200 hover:text-slate-600"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {remarkOpen && (
                <input
                  type="text"
                  value={local.remark}
                  onChange={(e) => setRemark(r.student_user_id, e.target.value)}
                  placeholder="Optional remark for this student…"
                  maxLength={2000}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        <span className="text-xs text-slate-500">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save journal
        </button>
      </div>
    </div>
  );
}
