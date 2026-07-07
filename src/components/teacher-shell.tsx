"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";

const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string;
  soon?: boolean;
}[] = [
  { href: "/dashboard/home", label: "Dashboard", icon: LayoutDashboard, match: "/dashboard/home" },
  { href: "/dashboard/school", label: "School setup", icon: Building2 },
  { href: "#", label: "Tutorials", icon: PlayCircle, soon: true },
  { href: "#", label: "Certification", icon: GraduationCap, soon: true },
  { href: "#", label: "Journal", icon: ClipboardList, soon: true },
];

type MySchool = {
  id: number;
  name: string;
  role_key: string;
  is_active: boolean;
};

function navPillClass(active: boolean, soon?: boolean) {
  if (soon) {
    return "border border-dashed border-slate-200 text-slate-400 cursor-default";
  }
  return active
    ? "border border-teal-700 bg-teal-700 text-white shadow-sm"
    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
}

export function TeacherShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut, loading } = useAuth();

  const { data: mySchools = [] } = useQuery<MySchool[]>({
    queryKey: ["/api/users/my-schools"],
    queryFn: async () => {
      const res = await fetch("/api/users/my-schools", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load schools");
      return res.json();
    },
    enabled: !!user,
  });

  const showSchoolSwitcher = mySchools.length > 1;

  async function handleSwitchSchool(schoolId: number) {
    if (!user || schoolId === user.school_id) return;
    const res = await fetch("/api/users/switch-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ school_id: schoolId }),
    });
    if (!res.ok) return;
    await queryClient.invalidateQueries();
    router.refresh();
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  const displayName = user.display_name || user.firebaseUser.email?.split("@")[0] || "Teacher";

  return (
    <div className="relative flex min-h-screen flex-col bg-[#f4f6f8] text-slate-900">
      <header className="relative z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* Row 1: logo + context + nav */}
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Link href="/dashboard/home" className="inline-flex items-baseline gap-2 transition-opacity hover:opacity-90">
                <span className="text-lg font-bold tracking-tight text-teal-800">AICUMEN</span>
                <span className="text-xs text-slate-400">by PropelUpAI</span>
              </Link>
              <div className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden />
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">Teacher Portal</span>
                {user.school_name && (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span>{user.school_name}</span>
                  </>
                )}
              </p>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navItems.map(({ href, label, icon: Icon, match, soon }) => {
                const active = !soon && (pathname === href || pathname === match);
                const className = `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${navPillClass(active, soon)}`;

                if (soon) {
                  return (
                    <span key={label} className={className} title="Coming soon">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                  );
                }

                return (
                  <Link key={href} href={href} className={className}>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Row 2: user chip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar name={displayName} photoUrl={user.photo_url} />
              <div>
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">
                  {user.school_role_key === "school_admin" ? "School admin" : "Teacher"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showSchoolSwitcher && (
                <select
                  value={user.school_id ?? ""}
                  onChange={(e) => handleSwitchSchool(parseInt(e.target.value, 10))}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  aria-label="Switch school"
                >
                  {mySchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} AICUMEN · A product of PropelUpAI, Inc.
      </footer>
    </div>
  );
}

type ActionCardProps = {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  accent?: "teal" | "sky" | "slate";
  badge?: string;
};

const accentStyles = {
  teal: {
    icon: "bg-teal-50 text-teal-700 ring-teal-100",
    hover: "hover:border-teal-200",
    link: "text-teal-700",
  },
  sky: {
    icon: "bg-sky-50 text-sky-700 ring-sky-100",
    hover: "hover:border-sky-200",
    link: "text-sky-700",
  },
  slate: {
    icon: "bg-slate-100 text-slate-500 ring-slate-200",
    hover: "",
    link: "text-slate-500",
  },
};

export function ActionCard({
  title,
  description,
  href,
  icon: Icon,
  accent = "teal",
  badge,
}: ActionCardProps) {
  const styles = accentStyles[accent];
  const isSoon = !!badge;

  const inner = (
    <div
      className={`group flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all ${
        isSoon
          ? "border-dashed border-slate-200 bg-slate-50/40"
          : `border-slate-200 ${styles.hover} hover:shadow-md`
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${styles.icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {badge && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            {badge}
          </span>
        )}
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
      {href && !badge && (
        <span className={`mt-5 text-sm font-medium ${styles.link}`}>Open →</span>
      )}
    </div>
  );

  if (href && !badge) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
