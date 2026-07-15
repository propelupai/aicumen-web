"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  PlayCircle,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { ActiveSessionBar } from "@/components/active-session-bar";
import { formatUserRoleLabel } from "@/lib/user-profile";

const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string;
  adminOnly?: boolean;
  contentAccess?: boolean;
}[] = [
  { href: "/dashboard/home", label: "Dashboard", icon: LayoutDashboard, match: "/dashboard/home" },
  { href: "/dashboard/school", label: "School", icon: Building2 },
  { href: "/dashboard/journal", label: "Journal", icon: ClipboardList },
  { href: "/dashboard/access", label: "People", icon: Shield, adminOnly: true },
  { href: "/dashboard/content", label: "Content", icon: BookOpen, contentAccess: true },
];

const comingSoonItems: { label: string; icon: LucideIcon; hint: string }[] = [
  { label: "Tutorials", icon: PlayCircle, hint: "Guided walkthroughs" },
  { label: "Certification", icon: GraduationCap, hint: "Earn your AI Period badge" },
];

type MySchool = {
  id: number;
  name: string;
  role_key: string;
  is_active: boolean;
};

function navPillClass(active: boolean) {
  return active
    ? "border border-teal-700 bg-teal-700 text-white shadow-sm"
    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
}

function visibleNavItems(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  return navItems.filter((item) => {
    if (item.adminOnly) {
      return user.school_role_key === "school_admin" || user.platform_role === "platform_admin";
    }
    if (item.contentAccess) {
      return user.platform_role === "platform_admin" || user.school_role_key === "school_admin";
    }
    return true;
  });
}

function ComingSoonMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 sm:text-sm"
      >
        More
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-50 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ring-1 ring-black/5"
        >
          <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Coming soon
          </p>
          {comingSoonItems.map(({ label, icon: Icon, hint }) => (
            <div
              key={label}
              role="menuitem"
              aria-disabled="true"
              className="flex items-start gap-2.5 px-3 py-2 text-slate-500"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs leading-snug text-slate-500">{hint}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const roleLabel = formatUserRoleLabel(user);
  const profileActive = pathname === "/dashboard/profile";
  const items = visibleNavItems(user);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#f4f6f8] text-slate-900">
      <header className="relative z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Link
                href="/dashboard/home"
                className="inline-flex shrink-0 items-baseline gap-1.5 transition-opacity hover:opacity-90"
              >
                <span className="text-lg font-bold tracking-tight text-teal-800">AICUMEN</span>
                <span className="hidden text-xs text-slate-400 sm:inline">by PropelUpAI</span>
              </Link>
              {user.school_name && (
                <>
                  <div className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
                  <p className="hidden truncate text-sm text-slate-500 sm:block">
                    {user.school_name}
                  </p>
                </>
              )}
            </div>

            <nav
              aria-label="Main"
              className="flex min-w-0 items-center gap-1.5 lg:flex-1 lg:justify-center"
            >
              <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map(({ href, label, icon: Icon, match }) => {
                  const active = pathname === href || pathname === match;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${navPillClass(active)}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
              <ComingSoonMenu />
            </nav>

            <div className="flex items-center justify-between gap-2 lg:shrink-0 lg:justify-end">
              <Link
                href="/dashboard/profile"
                className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1 transition-colors ${
                  profileActive ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-slate-50"
                }`}
                aria-current={profileActive ? "page" : undefined}
              >
                <UserAvatar name={displayName} photoUrl={user.photo_url} />
                <div className="min-w-0 hidden sm:block">
                  <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500">{roleLabel}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                {showSchoolSwitcher && (
                  <select
                    value={user.school_id ?? ""}
                    onChange={(e) => handleSwitchSchool(parseInt(e.target.value, 10))}
                    className="max-w-[9rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
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
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} AICUMEN · A product of PropelUpAI, Inc.
      </footer>

      <ActiveSessionBar />
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
