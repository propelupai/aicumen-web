import Link from "next/link";

type AicumenLogoProps = {
  href?: string;
  showBadge?: boolean;
  compact?: boolean;
};

export function AicumenLogo({ href = "/dashboard/home", showBadge = true, compact = false }: AicumenLogoProps) {
  const inner = (
    <div className="flex items-center gap-2.5">
      {showBadge && (
        <span
          className={`flex shrink-0 items-center justify-center rounded-lg bg-teal-800 font-bold text-white ${
            compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs"
          }`}
        >
          AI
        </span>
      )}
      <div className="flex flex-col leading-none sm:flex-row sm:items-baseline sm:gap-2">
        <span
          className={`font-bold tracking-tight text-teal-800 ${compact ? "text-base" : "text-lg"}`}
        >
          AICUMEN
        </span>
        <span className={`text-slate-400 ${compact ? "text-[10px]" : "text-xs"}`}>
          by PropelUpAI
        </span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-opacity hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}
