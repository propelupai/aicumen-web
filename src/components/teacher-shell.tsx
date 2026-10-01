"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  MoreHorizontal,
  PlayCircle,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { ActiveSessionBar } from "@/components/active-session-bar";
import { DedicatedAdvisorButton, PartnerBadge } from "@/components/school-partner-chrome";
import { formatUserRoleLabel } from "@/lib/user-profile";
import { useBrand } from "@/context/brand-context";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string;
  adminOnly?: boolean;
  contentAccess?: boolean;
};

const navItems: NavItem[] = [
  // Ordered by priority: earlier items stay visible; later ones collapse into
  // the "More" menu first when horizontal space runs out.
  { href: "/dashboard/home", label: "Dashboard", icon: LayoutDashboard, match: "/dashboard/home" },
  { href: "/dashboard/classes", label: "Classes", icon: Users },
  { href: "/dashboard/journal", label: "Journal", icon: ClipboardList },
  { href: "/dashboard/school", label: "Setup", icon: Building2 },
  { href: "/dashboard/access", label: "People", icon: Shield, adminOnly: true },
  { href: "/dashboard/content", label: "Customize", icon: BookOpen, contentAccess: true },
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

function isNavActive(pathname: string, item: NavItem): boolean {
  return (
    pathname === item.href ||
    pathname === item.match ||
    (item.href !== "/dashboard/home" && pathname.startsWith(`${item.href}/`))
  );
}

// useLayoutEffect on the client, useEffect during SSR (avoids the hydration warning).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

function NavPill({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${navPillClass(active)}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {item.label}
    </Link>
  );
}

/**
 * Top navigation that shows as many items as fit and collapses the rest into a
 * "More" menu. Items are prioritised by their order in `items` — the first ones
 * stay visible longest. The "More" menu also holds "coming soon" entries, so it
 * is always rendered and its width is always reserved.
 */
function ResponsiveNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  const itemsKey = items.map((i) => i.href).join(",");

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const GAP = 6; // matches gap-1.5

    function recompute() {
      if (!container || !measure) return;
      const itemEls = Array.from(measure.children) as HTMLElement[];
      const itemWidths = itemEls.map((el) => el.getBoundingClientRect().width);
      const moreWidth = moreRef.current?.getBoundingClientRect().width ?? 88;
      const available = container.getBoundingClientRect().width;

      // Always reserve room for the More button (holds coming-soon items).
      let used = moreWidth + GAP;
      let count = 0;
      for (const w of itemWidths) {
        const needed = w + GAP;
        if (used + needed <= available) {
          used += needed;
          count += 1;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [itemsKey]);

  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  return (
    <div ref={containerRef} className="flex min-w-0 flex-1 items-center justify-center">
      {/* Hidden measurement row: full item set, used to compute widths. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute -z-10 flex flex-nowrap gap-1.5"
      >
        {items.map((item) => (
          <NavPill key={item.href} item={item} active={false} />
        ))}
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        {visible.map((item) => (
          <NavPill key={item.href} item={item} active={isNavActive(pathname, item)} />
        ))}
        <MoreMenu ref={moreRef} overflow={overflow} pathname={pathname} />
      </div>
    </div>
  );
}

function MoreMenu({
  ref,
  overflow,
  pathname,
}: {
  ref: React.Ref<HTMLDivElement>;
  overflow: NavItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasOverflowActive = overflow.some((item) => isNavActive(pathname, item));

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

  // Close the menu whenever navigation changes route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="relative shrink-0"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
          hasOverflowActive
            ? "border-teal-700 bg-teal-700 text-white"
            : "border-dashed border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
        }`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        More
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-50 w-60 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ring-1 ring-black/5"
        >
          {overflow.length > 0 && (
            <div className="pb-1">
              {overflow.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-teal-50 text-teal-900" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-teal-700" : "text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
          <div className={overflow.length > 0 ? "border-t border-slate-100 pt-1.5" : ""}>
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
        </div>
      )}
    </div>
  );
}

/**
 * Combined account menu: profile, school switcher, and sign out live under the
 * user's name/avatar to keep the top bar uncluttered. Switching schools does a
 * full page reload so every part of the UI reflects the new school.
 */
function UserMenu({
  displayName,
  roleLabel,
  photoUrl,
  activeSchoolId,
  schools,
  profileActive,
  onSignOut,
}: {
  displayName: string;
  roleLabel: string;
  photoUrl: string | null;
  activeSchoolId: number | null;
  schools: MySchool[];
  profileActive: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  async function switchSchool(schoolId: number) {
    if (schoolId === activeSchoolId || switchingTo !== null) return;
    setSwitchingTo(schoolId);
    try {
      const res = await fetch("/api/users/switch-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ school_id: schoolId }),
      });
      if (!res.ok) {
        setSwitchingTo(null);
        return;
      }
      // Full reload so the header, nav, and every page pick up the new school.
      window.location.reload();
    } catch {
      setSwitchingTo(null);
    }
  }

  const showSwitcher = schools.length > 1;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors ${
          open || profileActive ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-slate-50"
        }`}
      >
        <UserAvatar name={displayName} photoUrl={photoUrl} />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {displayName}
          </span>
          <span className="block text-xs text-slate-500">{roleLabel}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+0.375rem)] right-0 z-50 w-64 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ring-1 ring-black/5"
        >
          {/* Non-interactive account header so menu items below read as actions. */}
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 pt-1 pb-2.5">
            <UserAvatar name={displayName} photoUrl={photoUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{roleLabel}</p>
            </div>
          </div>

          <div className="pt-1.5">
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`mx-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                profileActive
                  ? "bg-teal-50 text-teal-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <UserRound
                className={`h-4 w-4 shrink-0 ${profileActive ? "text-teal-700" : "text-slate-400"}`}
              />
              View profile
            </Link>
          </div>

          {showSwitcher && (
            <div className="mt-1 border-t border-slate-100 pt-1.5">
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Switch school
              </p>
              {schools.map((s) => {
                const active = s.id === activeSchoolId;
                const pending = switchingTo === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitem"
                    disabled={switchingTo !== null}
                    onClick={() => switchSchool(s.id)}
                    className={`mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors disabled:opacity-60 ${
                      active ? "bg-teal-50/60 text-teal-900" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Building2
                      className={`h-4 w-4 shrink-0 ${active ? "text-teal-700" : "text-slate-400"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {pending ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-700" />
                    ) : active ? (
                      <Check className="h-4 w-4 shrink-0 text-teal-700" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-1 border-t border-slate-100 pt-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 shrink-0 text-red-500" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeacherShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();
  const { name: brandName } = useBrand();

  const { data: mySchools = [] } = useQuery<MySchool[]>({
    queryKey: ["/api/users/my-schools"],
    queryFn: async () => {
      const res = await fetch("/api/users/my-schools", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load schools");
      return res.json();
    },
    enabled: !!user,
  });

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
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Link
                href="/dashboard/home"
                className="inline-flex shrink-0 items-baseline gap-1.5 transition-opacity hover:opacity-90"
              >
                <span className="text-lg font-bold tracking-tight text-teal-800">{brandName}</span>
                <span className="hidden text-xs text-slate-400 sm:inline">by PropelUpAI</span>
              </Link>
              {user.school_name && (
                <>
                  <div className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
                  <div className="hidden min-w-0 items-center gap-2 sm:flex">
                    <p className="truncate text-sm text-slate-500">{user.school_name}</p>
                    <PartnerBadge />
                  </div>
                </>
              )}
            </div>

            <nav aria-label="Main" className="flex min-w-0 items-center lg:flex-1">
              <ResponsiveNav items={items} pathname={pathname} />
            </nav>

            <div className="flex items-center justify-between gap-2 lg:shrink-0 lg:justify-end">
              <DedicatedAdvisorButton />
              <UserMenu
                displayName={displayName}
                roleLabel={roleLabel}
                photoUrl={user.photo_url ?? null}
                activeSchoolId={user.school_id}
                schools={mySchools}
                profileActive={profileActive}
                onSignOut={() => signOut()}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {brandName} · A product of PropelUpAI, Inc.
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
