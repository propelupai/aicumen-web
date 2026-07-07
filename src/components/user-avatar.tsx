type UserAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md";
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "T").toUpperCase();
}

const sizeClass = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
};

export function UserAvatar({ name, photoUrl, size = "md" }: UserAvatarProps) {
  const dim = sizeClass[size];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ring-1 ring-slate-200`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-teal-800 font-bold text-white`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
