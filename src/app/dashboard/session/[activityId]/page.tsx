"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageCircle,
  CheckCircle2,
  Monitor,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ActivityDetail } from "@/lib/activities";
import {
  broadcastPresentState,
  createPresentChannelId,
  type SessionPresentState,
} from "@/lib/session-broadcast";
import { useActiveSession } from "@/context/active-session-context";
import { JournalRosterEditor } from "@/components/journal-roster-editor";

type SessionPhase = "stem" | "coach" | "extend" | "done";

type SchoolSection = {
  id: number;
  display_name: string;
  grade: number;
};

function formatAnswerSpec(spec: Record<string, unknown> | null): string | null {
  if (!spec) return null;
  const body = spec.body as Record<string, unknown> | undefined;
  if (body?.value != null) {
    const unit = body.unit ? ` ${body.unit}` : "";
    return `${body.value}${unit}`;
  }
  return null;
}

export default function LiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { activeSession, hydrated, startSession, endSession } = useActiveSession();
  const activityId = parseInt(String(params.activityId ?? ""), 10);

  const initialSectionId = searchParams.get("sectionId");
  const [sectionId, setSectionId] = useState<number | null>(
    initialSectionId ? parseInt(initialSectionId, 10) : null,
  );
  const [phase, setPhase] = useState<SessionPhase>("stem");
  const [coachIndex, setCoachIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [channelId] = useState(() => createPresentChannelId(activityId));
  const [journalOpen, setJournalOpen] = useState(false);
  const projectorRef = useRef<Window | null>(null);
  const restoredRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());

  const { data: activity, isLoading, isError } = useQuery<ActivityDetail>({
    queryKey: ["/api/activities", activityId],
    queryFn: async () => {
      const res = await fetch(`/api/activities/${activityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load quest");
      return res.json();
    },
    enabled: Number.isInteger(activityId),
  });

  const { data: sections = [] } = useQuery<SchoolSection[]>({
    queryKey: ["/api/school/sections"],
    queryFn: async () => {
      const res = await fetch("/api/school/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
  });

  const progressMutation = useMutation({
    mutationFn: async (status: "completed" | "in_progress") => {
      if (!sectionId) return;
      const res = await fetch(`/api/sections/${sectionId}/progress`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: activityId, status }),
      });
      if (!res.ok) throw new Error("Failed to save progress");
    },
    onSuccess: () => {
      if (!sectionId) return;
      queryClient.invalidateQueries({ queryKey: [`/api/sections/${sectionId}/progress`] });
      queryClient.invalidateQueries({ queryKey: ["/api/sections/completed", sectionId] });
    },
  });

  const coachSteps = activity?.coach_steps ?? [];
  const currentStep = coachSteps[coachIndex] ?? null;
  const totalCoachSteps = coachSteps.length;
  const stemAnswer = formatAnswerSpec(activity?.stem?.answer_spec ?? null);
  const extendAnswer = formatAnswerSpec(activity?.extend?.answer_spec ?? null);

  const deliveryAids = useMemo(() => {
    const d = activity?.stem?.delivery;
    if (!d || typeof d !== "object") return [];
    return Object.entries(d).map(([key, value]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      text: String(value),
    }));
  }, [activity?.stem?.delivery]);

  const presentState = useMemo((): SessionPresentState | null => {
    if (!activity) return null;
    const subjectLine = [
      activity.subject_name,
      activity.theme,
      activity.chapter_title,
    ]
      .filter(Boolean)
      .join(" · ");

    if (phase === "stem" && activity.stem) {
      const firstAid = deliveryAids[0] ?? null;
      return {
        activityId,
        phase,
        coachIndex,
        title: activity.title,
        emoji: activity.emoji,
        theme: activity.theme,
        chapterTitle: activity.chapter_title,
        subjectLine,
        questCode: activity.quest_code,
        displayText: activity.stem.stem,
        stepLabel: null,
        stepNumber: null,
        totalSteps: totalCoachSteps,
        deliveryAid: firstAid ? { label: firstAid.label, text: firstAid.text } : null,
      };
    }
    if (phase === "coach" && currentStep) {
      return {
        activityId,
        phase,
        coachIndex,
        title: activity.title,
        emoji: activity.emoji,
        theme: activity.theme,
        chapterTitle: activity.chapter_title,
        subjectLine,
        questCode: activity.quest_code,
        displayText: currentStep.stem,
        stepLabel: currentStep.label,
        stepNumber: coachIndex + 1,
        totalSteps: totalCoachSteps,
        deliveryAid: null,
      };
    }
    if (phase === "extend" && activity.extend) {
      return {
        activityId,
        phase,
        coachIndex,
        title: activity.title,
        emoji: activity.emoji,
        theme: activity.theme,
        chapterTitle: activity.chapter_title,
        subjectLine,
        questCode: activity.quest_code,
        displayText: activity.extend.stem,
        stepLabel: "Stretch",
        stepNumber: null,
        totalSteps: totalCoachSteps,
        deliveryAid: null,
      };
    }
    if (phase === "done") {
      return {
        activityId,
        phase,
        coachIndex,
        title: activity.title,
        emoji: activity.emoji,
        theme: activity.theme,
        chapterTitle: activity.chapter_title,
        subjectLine,
        questCode: activity.quest_code,
        displayText: "",
        stepLabel: null,
        stepNumber: null,
        totalSteps: totalCoachSteps,
        deliveryAid: null,
      };
    }
    return null;
  }, [
    activity,
    activityId,
    phase,
    coachIndex,
    currentStep,
    totalCoachSteps,
    deliveryAids,
  ]);

  useEffect(() => {
    if (presentState) broadcastPresentState(channelId, presentState);
  }, [channelId, presentState]);

  // Restore in-progress state once when resuming an existing active session.
  useEffect(() => {
    if (!activity || !hydrated || restoredRef.current) return;
    if (activeSession && activeSession.activityId === activityId) {
      setPhase(activeSession.phase as SessionPhase);
      setCoachIndex(activeSession.coachIndex);
      setSectionId((cur) => (cur == null ? activeSession.sectionId : cur));
      startedAtRef.current = activeSession.startedAt;
    } else {
      startedAtRef.current = Date.now();
    }
    restoredRef.current = true;
  }, [activity, hydrated, activeSession, activityId]);

  // Keep the persistent active-session store in sync with the live session.
  useEffect(() => {
    if (!activity || !restoredRef.current) return;
    startSession({
      activityId,
      sectionId,
      title: activity.title,
      emoji: activity.emoji,
      questCode: activity.quest_code,
      phase,
      coachIndex,
      totalCoachSteps,
      startedAt: startedAtRef.current,
    });
  }, [
    activity,
    sectionId,
    phase,
    coachIndex,
    activityId,
    totalCoachSteps,
    startSession,
  ]);

  function openProjector() {
    const url = `/present/${activityId}?channel=${encodeURIComponent(channelId)}`;
    if (projectorRef.current && !projectorRef.current.closed) {
      projectorRef.current.focus();
      if (presentState) broadcastPresentState(channelId, presentState);
      return;
    }
    projectorRef.current = window.open(
      url,
      `aicumen-present-${activityId}`,
      "noopener,noreferrer,width=1280,height=720",
    );
    if (presentState) broadcastPresentState(channelId, presentState);
  }

  function goNext() {
    setShowHint(false);
    setShowNotes(false);
    if (phase === "stem") {
      if (totalCoachSteps > 0) {
        setPhase("coach");
        setCoachIndex(0);
      } else if (activity?.extend) {
        setPhase("extend");
      } else {
        setPhase("done");
      }
      return;
    }
    if (phase === "coach") {
      if (coachIndex < totalCoachSteps - 1) {
        setCoachIndex((i) => i + 1);
      } else if (activity?.extend) {
        setPhase("extend");
      } else {
        setPhase("done");
      }
      return;
    }
    if (phase === "extend") {
      setPhase("done");
    }
  }

  function goPrev() {
    setShowHint(false);
    setShowNotes(false);
    if (phase === "coach" && coachIndex > 0) {
      setCoachIndex((i) => i - 1);
      return;
    }
    if (phase === "coach" && coachIndex === 0) {
      setPhase("stem");
      return;
    }
    if (phase === "extend") {
      if (totalCoachSteps > 0) {
        setPhase("coach");
        setCoachIndex(totalCoachSteps - 1);
      } else {
        setPhase("stem");
      }
      return;
    }
    if (phase === "done") {
      if (activity?.extend) setPhase("extend");
      else if (totalCoachSteps > 0) {
        setPhase("coach");
        setCoachIndex(totalCoachSteps - 1);
      } else setPhase("stem");
    }
  }

  async function handleMarkComplete() {
    if (sectionId) {
      await progressMutation.mutateAsync("completed");
    }
    endSession();
    router.push("/dashboard/home");
  }

  function handleEndSession() {
    endSession();
    router.push("/dashboard/home");
  }

  if (!Number.isInteger(activityId)) {
    return <p className="text-sm text-red-600">Invalid quest.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  if (isError || !activity) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="text-sm text-red-800">Could not load this quest.</p>
        <Link href="/dashboard/home" className="mt-4 inline-block text-sm font-medium text-teal-700">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/home"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          title="Keep this session live and return later from the resume bar"
        >
          <ArrowLeft className="h-4 w-4" />
          Minimize
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {sections.length > 0 && (
            <select
              value={sectionId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setSectionId(Number.isInteger(id) ? id : null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              aria-label="Class section"
            >
              <option value="">No section (skip progress)</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          )}
          <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
            {activity.quest_code}
          </span>
          <button
            type="button"
            onClick={() => setJournalOpen(true)}
            disabled={!sectionId}
            title={sectionId ? "Mark students without leaving the session" : "Pick a section to mark students"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardList className="h-4 w-4" />
            Mark students
          </button>
          <button
            type="button"
            onClick={openProjector}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900"
          >
            <Monitor className="h-4 w-4" />
            Open projector
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-4 w-4" />
            End session
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Project to class */}
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-widest text-teal-300 uppercase">
              Class preview
            </p>
            <p className="text-xs text-slate-400">
              Use <span className="text-teal-300">Open projector</span> for the classroom screen
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-4xl" aria-hidden>
              {activity.emoji}
            </span>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{activity.title}</h1>
              <p className="mt-1 text-sm text-slate-300">
                {activity.theme} · {activity.chapter_title}
              </p>
            </div>
          </div>

          {phase === "stem" && activity.stem && (
            <p className="mt-8 text-lg leading-relaxed font-medium sm:text-xl">
              {activity.stem.stem}
            </p>
          )}

          {phase === "coach" && currentStep && (
            <div className="mt-8">
              <p className="text-sm text-teal-300">
                Step {coachIndex + 1} of {totalCoachSteps}
                {currentStep.label ? ` · ${currentStep.label}` : ""}
              </p>
              <p className="mt-3 text-lg leading-relaxed font-medium sm:text-xl">
                {currentStep.stem}
              </p>
            </div>
          )}

          {phase === "extend" && activity.extend && (
            <div className="mt-8">
              <p className="text-sm text-amber-300">Stretch question</p>
              <p className="mt-3 text-lg leading-relaxed font-medium sm:text-xl">
                {activity.extend.stem}
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="mt-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-teal-400" />
              <p className="mt-4 text-lg font-semibold">Quest complete</p>
              <p className="mt-2 text-sm text-slate-300">
                Great session. Mark complete to record progress for this section.
              </p>
            </div>
          )}

          {deliveryAids.length > 0 && phase === "stem" && (
            <div className="mt-8 flex flex-wrap gap-2">
              {deliveryAids.map((aid) => (
                <span
                  key={aid.key}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200"
                  title={aid.text}
                >
                  {aid.label}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Teacher coach panel */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            Your coach guide
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Read prompts aloud. Reveal hints only when students need a nudge.
          </p>

          {phase === "stem" && activity.stem?.hint && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <p className="text-xs font-semibold text-amber-800">Stem hint (if stuck)</p>
              <p className="mt-1 text-sm text-amber-900">
                {showHint ? activity.stem.hint : "—"}
              </p>
              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800"
              >
                {showHint ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showHint ? "Hide hint" : "Reveal hint"}
              </button>
            </div>
          )}

          {phase === "coach" && currentStep && (
            <div className="mt-4 space-y-3">
              {currentStep.hint && (
                <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
                  <p className="flex items-center gap-1 text-xs font-semibold text-amber-800">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Hint if stuck
                  </p>
                  <p className="mt-1 text-sm text-amber-900">
                    {showHint ? currentStep.hint : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowHint((v) => !v)}
                    className="mt-2 text-xs font-semibold text-amber-800"
                  >
                    {showHint ? "Hide" : "Reveal"}
                  </button>
                </div>
              )}
              {currentStep.teacher_notes && (
                <div className="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-100">
                  <p className="flex items-center gap-1 text-xs font-semibold text-sky-800">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Facilitation note
                  </p>
                  <p className="mt-1 text-sm text-sky-900">
                    {showNotes ? currentStep.teacher_notes : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNotes((v) => !v)}
                    className="mt-2 text-xs font-semibold text-sky-800"
                  >
                    {showNotes ? "Hide" : "Reveal"}
                  </button>
                </div>
              )}
            </div>
          )}

          {(phase === "stem" || phase === "extend" || phase === "done") && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-xs font-semibold text-slate-600">Reference answer (teacher only)</p>
              <p className="mt-1 text-sm text-slate-800">
                {showAnswer
                  ? phase === "extend"
                    ? extendAnswer ?? "See teacher guide"
                    : stemAnswer ?? "See teacher guide"
                  : "—"}
              </p>
              <button
                type="button"
                onClick={() => setShowAnswer((v) => !v)}
                className="mt-2 text-xs font-semibold text-slate-600"
              >
                {showAnswer ? "Hide answer" : "Reveal answer"}
              </button>
            </div>
          )}

          {activity.ai_concept && (
            <p className="mt-4 text-xs text-slate-500">
              AI link: <span className="text-slate-700">{activity.ai_concept}</span>
            </p>
          )}

          {(activity.mandates?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
                CBSE handbook mandate
              </p>
              <ul className="mt-2 space-y-1.5">
                {activity.mandates!.map((m) => (
                  <li key={`${m.grade}-${m.code}`} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0 rounded bg-teal-100 px-1.5 py-0.5 font-bold text-teal-800">
                      {m.code}
                    </span>
                    <span className="text-slate-700">
                      {m.handbook_item}
                      {m.unit ? <span className="text-slate-400"> · {m.unit}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">
                Running this quest contributes to the Grade {activity.grade} AI handbook coverage
                above.
              </p>
            </div>
          )}

          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            {phase !== "stem" && phase !== "done" && (
              <button
                type="button"
                onClick={goPrev}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            {phase !== "done" ? (
              <button
                type="button"
                onClick={() => {
                  if (sectionId && phase === "stem") {
                    progressMutation.mutate("in_progress");
                  }
                  goNext();
                }}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                {phase === "extend" ? "Finish quest" : "Next step"}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                {sectionId && (
                  <Link
                    href={`/dashboard/journal?section_id=${sectionId}&activity_id=${activityId}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Journal
                  </Link>
                )}
                <button
                  type="button"
                  disabled={progressMutation.isPending}
                  onClick={handleMarkComplete}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {progressMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Mark complete
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Mark students slide-over */}
      {journalOpen && sectionId != null && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setJournalOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-teal-700" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Mark students</p>
                  <p className="text-xs text-slate-500">
                    Assess the class on this activity — saves to the journal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setJournalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <JournalRosterEditor sectionId={sectionId} activityId={activityId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
