import { ShieldCheck } from "lucide-react";
import type { ActivityAccent, ActivityListItem } from "@/lib/activities";

const accentMap: Record<
  ActivityAccent,
  { badge: string; button: string; border: string }
> = {
  teal: {
    badge: "bg-teal-50 text-teal-800 ring-teal-100",
    button: "bg-teal-700 hover:bg-teal-800 text-white",
    border: "border-teal-100 hover:border-teal-200",
  },
  sky: {
    badge: "bg-sky-50 text-sky-800 ring-sky-100",
    button: "bg-sky-700 hover:bg-sky-800 text-white",
    border: "border-sky-100 hover:border-sky-200",
  },
  amber: {
    badge: "bg-amber-50 text-amber-900 ring-amber-100",
    button: "bg-amber-700 hover:bg-amber-800 text-white",
    border: "border-amber-100 hover:border-amber-200",
  },
  slate: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    button: "bg-slate-700 hover:bg-slate-800 text-white",
    border: "border-slate-200 hover:border-slate-300",
  },
};

function stars(n: number) {
  const clamped = Math.min(3, Math.max(1, n));
  return "★".repeat(clamped) + "☆".repeat(3 - clamped);
}

function formatCompletedDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

type QuestCardProps = {
  activity: ActivityListItem;
  disabled?: boolean;
  onRun?: () => void;
  runLabel?: string;
  completedAt?: string | null;
  progressStatus?: string;
};

export function QuestCard({
  activity,
  disabled = true,
  onRun,
  runLabel,
  completedAt,
  progressStatus,
}: QuestCardProps) {
  const accent = accentMap[activity.accent] ?? accentMap.teal;
  const isCompleted = progressStatus === "completed" || !!completedAt;
  const buttonLabel = runLabel ?? (disabled ? "Soon" : "Run live →");

  const mandates = activity.mandates ?? [];
  const mandateCodes = mandates.map((m) => m.code);
  const shownCodes = mandateCodes.slice(0, 3);
  const extraCount = mandateCodes.length - shownCodes.length;
  const mandateTooltip = mandates
    .map((m) => `${m.code} · ${m.handbook_item}`)
    .join("\n");

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all ${accent.border} ${
        disabled ? "opacity-90" : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ring-1 ${accent.badge}`}
        >
          {activity.quest_code}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {isCompleted && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Done
            </span>
          )}
          {progressStatus === "in_progress" && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200">
              In progress
            </span>
          )}
          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
            {activity.source_type_label ??
              (activity.activity_type
                ? activity.activity_type.replace(/_/g, " ")
                : activity.skill)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center text-center">
        <span className="text-4xl" role="img" aria-hidden>
          {activity.emoji}
        </span>
        <h3 className="mt-3 text-base font-bold text-slate-900">{activity.title}</h3>
        <p className="mt-1.5 text-xs text-slate-500">
          {activity.theme} · {stars(activity.stars)} · {activity.difficulty}
        </p>
        {mandateCodes.length > 0 && (
          <p
            className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400"
            title={mandateTooltip}
          >
            <ShieldCheck className="h-3 w-3" />
            CBSE {shownCodes.join(", ")}
            {extraCount > 0 ? ` +${extraCount}` : ""}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">
          {completedAt
            ? `Completed ${formatCompletedDate(completedAt)}`
            : `${activity.coach_step_count} Socratic prompts`}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onRun}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${accent.button}`}
        >
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}
