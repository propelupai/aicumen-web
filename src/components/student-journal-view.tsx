"use client";

import { ShieldCheck } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { LevelDistribution } from "@/components/journal-roster-editor";
import {
  JOURNAL_LEVELS,
  JOURNAL_LEVEL_META,
  type JournalLevel,
  isJournalLevel,
} from "@/lib/journal";

type LevelCountRow = {
  got_answer: number;
  got_rule: number;
  able_to_teach: number;
};

export type StudentJournal = {
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

/** Read-only student progress panel: overall ladder, by-subject, mandate mastery, and timeline. */
export function StudentJournalView({ data }: { data: StudentJournal }) {
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
