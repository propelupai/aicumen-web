"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, Mail, Shield, User } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { useToast } from "@/hooks/use-toast";
import {
  formatAccountTypeLabel,
  formatSchoolRoleLabel,
  formatUserRoleLabel,
} from "@/lib/user-profile";

type SchoolMembership = {
  id: number;
  name: string;
  role_key: string;
  joined_at: string;
  is_active: boolean;
};

type Profile = {
  user_id: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  username: string | null;
  school_id: number | null;
  school_name: string | null;
  account_type: string;
  platform_role: string | null;
  school_role_key: string | null;
  created_at: string;
  schools: SchoolMembership[];
};

function formatMemberSince(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");

  const { data: profile, isLoading, isError } = useQuery<Profile>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile?.display_name != null) {
      setDisplayName(profile.display_name);
    }
  }, [profile?.display_name]);

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not save profile");
      }
      return res.json() as Promise<Profile>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated", description: "Your display name has been saved." });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not save",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const switchSchoolMutation = useMutation({
    mutationFn: async (schoolId: number) => {
      const res = await fetch("/api/users/switch-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ school_id: schoolId }),
      });
      if (!res.ok) throw new Error("Could not switch school");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.refresh();
      toast({ title: "School switched", description: "Your active school has been updated." });
    },
    onError: () => {
      toast({
        title: "Could not switch school",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const trimmedName = displayName.trim();
  const isDirty =
    profile != null && trimmedName !== (profile.display_name ?? "").trim();
  const canSave = isDirty && trimmedName.length > 0 && !saveMutation.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    saveMutation.mutate(trimmedName);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not load your profile. Please refresh or sign in again.
      </p>
    );
  }

  const roleLabel = formatUserRoleLabel(profile);
  const accountLabel = formatAccountTypeLabel(profile.account_type);
  const avatarName = profile.display_name || profile.email.split("@")[0] || "User";
  const schools = profile.schools ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Your profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          View your roles across schools. You can update your display name — email and per-school
          roles are managed by your school admins.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <UserAvatar name={avatarName} photoUrl={profile.photo_url} size="md" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">{avatarName}</p>
            <p className="truncate text-sm text-slate-500">{profile.email}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-teal-700" />
          <h2 className="text-sm font-semibold text-slate-900">Account &amp; roles</h2>
        </div>
        <dl className="mt-4 space-y-4">
          {profile.platform_role === "platform_admin" && (
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Platform role
              </dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-900 ring-1 ring-violet-200">
                  Platform admin
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Active school role
            </dt>
            <dd className="mt-1">
              <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-900 ring-1 ring-teal-200">
                {roleLabel}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Account type
            </dt>
            <dd className="mt-1 text-sm text-slate-800">{accountLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Member since
            </dt>
            <dd className="mt-1 text-sm text-slate-800">{formatMemberSince(profile.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-teal-700" />
          <h2 className="text-sm font-semibold text-slate-900">Your schools</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {schools.length === 1
            ? "You belong to one school."
            : `You belong to ${schools.length} schools. Switch which one is active for this session.`}
        </p>

        {schools.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No school memberships found.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {schools.map((school) => (
              <li
                key={school.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{school.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatSchoolRoleLabel(school.role_key)}
                    {" · "}
                    Joined {formatMemberSince(school.joined_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {school.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={switchSchoolMutation.isPending}
                      onClick={() => switchSchoolMutation.mutate(school.id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 disabled:opacity-50"
                    >
                      Switch here
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-teal-700" />
          <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="How your name appears in the app"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Email</span>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={profile.email}
                readOnly
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-500"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Email is tied to your sign-in and cannot be changed here.
            </p>
          </label>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
            {isDirty && !saveMutation.isPending && (
              <button
                type="button"
                onClick={() => setDisplayName(profile.display_name ?? "")}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
