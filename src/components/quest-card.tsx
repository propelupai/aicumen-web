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

type QuestCardProps = {
  activity: ActivityListItem;
  disabled?: boolean;
  onRun?: () => void;
};

export function QuestCard({ activity, disabled = true, onRun }: QuestCardProps) {
  const accent = accentMap[activity.accent] ?? accentMap.teal;

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
        <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
          {activity.skill}
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center text-center">
        <span className="text-4xl" role="img" aria-hidden>
          {activity.emoji}
        </span>
        <h3 className="mt-3 text-base font-bold text-slate-900">{activity.title}</h3>
        <p className="mt-1.5 text-xs text-slate-500">
          {activity.theme} · {stars(activity.stars)} · {activity.difficulty}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">
          {activity.coach_step_count} Socratic prompts
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onRun}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${accent.button}`}
        >
          {disabled ? "Soon" : "Run live →"}
        </button>
      </div>
    </article>
  );
}
