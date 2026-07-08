"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, X } from "lucide-react";
import { useState } from "react";
import type { QuestionRow } from "@/lib/activities";

type ActivityWithQuestions = {
  id: number;
  title: string;
  status: string;
  questions: QuestionRow[];
};

type CoachReviewPanelProps = {
  activityId: number;
  onClose: () => void;
  onPublished?: () => void;
};

export function CoachReviewPanel({ activityId, onClose, onPublished }: CoachReviewPanelProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, Partial<QuestionRow>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ActivityWithQuestions>({
    queryKey: ["/api/content/activities", activityId],
    queryFn: async () => {
      const res = await fetch(`/api/content/activities/${activityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: { id: number; patch: Record<string, unknown> }[]) => {
      for (const { id, patch } of updates) {
        const res = await fetch(`/api/content/questions/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Failed to save question");
      }
    },
    onSuccess: () => {
      setDrafts({});
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/content/activities", activityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/content/review-queue"] });
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/content/activities/${activityId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) throw new Error("Publish failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content/review-queue"] });
      onPublished?.();
      onClose();
    },
  });

  const questions = data?.questions ?? [];
  const stem = questions.find((q) => q.role === "stem");
  const coachSteps = questions.filter((q) => q.role === "coach_step");
  const extend = questions.find((q) => q.role === "extend");

  function field(id: number, key: keyof QuestionRow): string {
    const draft = drafts[id]?.[key];
    if (draft != null) return String(draft);
    const row = questions.find((q) => q.id === id);
    const val = row?.[key];
    return val == null ? "" : String(val);
  }

  function setField(id: number, key: keyof QuestionRow, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }

  function handleSave() {
    const updates = Object.entries(drafts).map(([idStr, patch]) => ({
      id: parseInt(idStr, 10),
      patch: patch as Record<string, unknown>,
    }));
    if (updates.length === 0) return;
    saveMutation.mutate(updates);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{data?.title}</h2>
          <p className="text-sm text-slate-500">Edit Socratic coach ladder before publishing</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-5">
        {stem && (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Class question (stem)</h3>
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{stem.stem}</p>
            {stem.hint && (
              <p className="mt-2 text-xs text-slate-500">
                Stem hint: <span className="text-slate-700">{stem.hint}</span>
              </p>
            )}
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-slate-900">
            Coach steps ({coachSteps.length})
          </h3>
          <div className="mt-3 space-y-4">
            {coachSteps.map((step, idx) => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="text-xs font-semibold text-teal-700">
                  Step {idx + 1}
                  {step.label ? ` · ${step.label}` : ""}
                </p>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Prompt to read aloud
                  <textarea
                    value={field(step.id, "stem")}
                    onChange={(e) => setField(step.id, "stem", e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Hint if stuck
                  <textarea
                    value={field(step.id, "hint")}
                    onChange={(e) => setField(step.id, "hint", e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Facilitation note (teacher only)
                  <textarea
                    value={field(step.id, "teacher_notes")}
                    onChange={(e) => setField(step.id, "teacher_notes", e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        {extend && (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Stretch question</h3>
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{extend.stem}</p>
          </section>
        )}
      </div>

      {saveError && (
        <p className="px-5 pb-2 text-sm text-red-600">{saveError}</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          disabled={saveMutation.isPending || Object.keys(drafts).length === 0}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save edits
        </button>
        <button
          type="button"
          disabled={publishMutation.isPending}
          onClick={() => publishMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {publishMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Approve & publish
        </button>
      </div>
    </div>
  );
}
