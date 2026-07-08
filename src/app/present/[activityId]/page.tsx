"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type SessionPresentState,
  subscribePresentState,
} from "@/lib/session-broadcast";

function PresentContent() {
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channel") ?? "";
  const [state, setState] = useState<SessionPresentState | null>(null);

  useEffect(() => {
    if (!channelId) return;
    return subscribePresentState(channelId, setState);
  }, [channelId]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  if (!channelId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-lg">Missing projector link. Open this window from your live session.</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <p className="text-2xl font-semibold text-teal-300">Waiting for teacher…</p>
        <p className="mt-2 text-slate-400">Keep this window open on the classroom display.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-8 py-10 text-white sm:px-16 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <span className="text-5xl sm:text-6xl" aria-hidden>
            {state.emoji}
          </span>
          <div>
            <p className="text-sm font-semibold tracking-widest text-teal-400 uppercase">
              AICUMEN · {state.questCode}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-4xl">{state.title}</h1>
            <p className="mt-1 text-base text-slate-400 sm:text-lg">{state.subjectLine}</p>
          </div>
        </div>
        {state.stepNumber != null && state.totalSteps > 0 && (
          <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-slate-200">
            Step {state.stepNumber} of {state.totalSteps}
            {state.stepLabel ? ` · ${state.stepLabel}` : ""}
          </p>
        )}
      </header>

      <main className="flex flex-1 flex-col justify-center py-10">
        {state.phase === "done" ? (
          <div className="text-center">
            <p className="text-4xl font-bold text-teal-300 sm:text-5xl">Great thinking!</p>
            <p className="mt-4 text-xl text-slate-400">Quest complete</p>
          </div>
        ) : (
          <p className="max-w-5xl text-2xl leading-relaxed font-medium sm:text-4xl sm:leading-snug lg:text-5xl">
            {state.displayText}
          </p>
        )}

        {state.deliveryAid && state.phase === "stem" && (
          <div className="mt-10 max-w-3xl rounded-2xl border border-white/15 bg-white/5 px-6 py-5">
            <p className="text-xs font-semibold tracking-wide text-teal-300 uppercase">
              {state.deliveryAid.label}
            </p>
            <p className="mt-2 text-lg text-slate-200 sm:text-xl">{state.deliveryAid.text}</p>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 pt-4 text-center text-xs text-slate-500">
        Classroom display · synced with teacher tablet
      </footer>
    </div>
  );
}

export default function PresentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <p>Loading projector…</p>
        </div>
      }
    >
      <PresentContent />
    </Suspense>
  );
}
