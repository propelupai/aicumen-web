"use client";

import { usePathname, useRouter } from "next/navigation";
import { PlayCircle, Radio, X } from "lucide-react";
import { useActiveSession } from "@/context/active-session-context";

function phaseLabel(phase: string, coachIndex: number, totalCoachSteps: number): string {
  switch (phase) {
    case "stem":
      return "Intro question";
    case "coach":
      return totalCoachSteps > 0
        ? `Coach step ${Math.min(coachIndex + 1, totalCoachSteps)} of ${totalCoachSteps}`
        : "Coaching";
    case "extend":
      return "Stretch question";
    case "done":
      return "Wrap-up";
    default:
      return "In progress";
  }
}

/** Persistent bar to resume or end a live session from any dashboard page. */
export function ActiveSessionBar() {
  const { activeSession, hydrated, endSession } = useActiveSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!hydrated || !activeSession) return null;

  const sessionPath = `/dashboard/session/${activeSession.activityId}`;
  // Hide while the teacher is already on this session's page.
  if (pathname === sessionPath) return null;

  const resumeHref =
    activeSession.sectionId != null
      ? `${sessionPath}?sectionId=${activeSession.sectionId}`
      : sessionPath;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-teal-200 bg-white/95 px-4 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <span className="text-lg" aria-hidden>
            {activeSession.emoji || "🎯"}
          </span>
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-500" />
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-teal-700 uppercase">
            <Radio className="h-3 w-3" />
            Live session
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {activeSession.questCode ? (
              <span className="text-slate-400">{activeSession.questCode} · </span>
            ) : null}
            {activeSession.title}
          </p>
          <p className="truncate text-xs text-slate-500">
            {phaseLabel(activeSession.phase, activeSession.coachIndex, activeSession.totalCoachSteps)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push(resumeHref)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <PlayCircle className="h-4 w-4" />
          Resume
        </button>
        <button
          type="button"
          onClick={endSession}
          title="End session"
          aria-label="End session"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
