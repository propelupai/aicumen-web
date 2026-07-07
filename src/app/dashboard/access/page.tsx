"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";

type Tab = "staff" | "students" | "roles";

type StaffMember = {
  user_id: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  role_key: string;
  has_signed_in: boolean;
  joined_at: string;
};

type StudentRow = {
  user_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  active_section_name: string | null;
};

type RoleDefinition = {
  key: string;
  label: string;
  description: string;
  permissions: { key: string; label: string }[];
};

type SchoolInfo = {
  id: number;
  name: string;
  signup_code: string;
};

const ROLE_BADGE: Record<string, string> = {
  school_admin: "bg-teal-100 text-teal-800 ring-teal-200",
  teacher: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function AccessManagementPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("staff");
  const isAdmin =
    user?.school_role_key === "school_admin" || user?.platform_role === "platform_admin";

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <Shield className="mx-auto h-10 w-10 text-amber-600" />
        <h1 className="mt-4 text-lg font-semibold text-amber-950">Access restricted</h1>
        <p className="mt-2 text-sm text-amber-800">
          Only school admins can manage staff access and the student roster.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">
          Administration
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          People & access
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage who can access your school, assign roles, and maintain the student roster.
        </p>
      </section>

      <InviteBanner />

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {(
            [
              { id: "staff" as Tab, label: "Staff", icon: UserCog },
              { id: "students" as Tab, label: "Students", icon: Users },
              { id: "roles" as Tab, label: "Roles & permissions", icon: Shield },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === id
                  ? "border-teal-700 text-teal-800"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "staff" && <StaffTab currentUserId={user?.user_id} />}
      {tab === "students" && <StudentsTab />}
      {tab === "roles" && <RolesTab />}
    </div>
  );
}

function InviteBanner() {
  const [copied, setCopied] = useState(false);
  const { data: school, isLoading } = useQuery<SchoolInfo>({
    queryKey: ["/api/school/info"],
    queryFn: async () => {
      const res = await fetch("/api/school/info", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load school info");
      return res.json();
    },
  });

  async function copyCode() {
    if (!school?.signup_code) return;
    await navigator.clipboard.writeText(school.signup_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200/80 bg-teal-50/50 px-5 py-4">
      <div>
        <p className="text-sm font-medium text-teal-900">Invite staff to {school?.name}</p>
        <p className="mt-0.5 text-xs text-teal-700/80">
          Share this signup code. New teachers sign up at the login page with this code.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <code className="rounded-lg bg-white px-4 py-2 font-mono text-sm font-semibold tracking-wider text-slate-800 ring-1 ring-teal-200">
          {school?.signup_code ?? "—"}
        </code>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function StaffTab({ currentUserId }: { currentUserId?: string }) {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/school/members"],
    queryFn: async () => {
      const res = await fetch("/api/school/members", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, roleKey }: { userId: string; roleKey: string }) => {
      const res = await fetch(`/api/school/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role_key: roleKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to update role");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/school/members"] }),
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Staff members</h2>
        <p className="text-sm text-slate-500">{members.length} people with teacher portal access</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-6 py-3">Member</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.user_id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={m.display_name ?? m.email}
                      photoUrl={m.photo_url}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {m.display_name ?? m.email}
                        {m.user_id === currentUserId && (
                          <span className="ml-2 text-xs text-slate-400">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={m.role_key}
                    disabled={updateRole.isPending}
                    onChange={(e) =>
                      updateRole.mutate({ userId: m.user_id, roleKey: e.target.value })
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="school_admin">School admin</option>
                  </select>
                  {updateRole.isError && m.user_id === updateRole.variables?.userId && (
                    <p className="mt-1 text-xs text-red-600">
                      {(updateRole.error as Error).message}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                      ROLE_BADGE[m.role_key] ?? ROLE_BADGE.teacher
                    }`}
                  >
                    {m.role_key === "school_admin" ? "Admin" : "Teacher"}
                  </span>
                  {!m.has_signed_in && (
                    <p className="mt-1 text-xs text-amber-600">Pending sign-in</p>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(m.joined_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function StudentsTab() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: students = [], isLoading } = useQuery<StudentRow[]>({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const res = await fetch("/api/students", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load students");
      return res.json();
    },
  });

  const removeStudent = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/students/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: false }),
      });
      if (!res.ok) throw new Error("Failed to remove student");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/students"] }),
  });

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Student roster</h2>
            <p className="text-sm text-slate-500">
              {students.length} students · assign to sections in School setup
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Add student
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
          </div>
        ) : students.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No students yet. Add students to your school roster, then assign them to sections.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Login</th>
                <th className="px-6 py-3">Section</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => (
                <tr key={s.user_id}>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {s.display_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {s.username ? `@${s.username}` : s.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {s.active_section_name ?? (
                      <span className="text-amber-600">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${s.display_name ?? s.email} from the roster?`)) {
                          removeStudent.mutate(s.user_id);
                        }
                      }}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove student"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          setAddOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/students"] });
        }}
      />
    </>
  );
}

function RolesTab() {
  const { data: roles = [], isLoading } = useQuery<RoleDefinition[]>({
    queryKey: ["/api/school/roles"],
    queryFn: async () => {
      const res = await fetch("/api/school/roles", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load roles");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => (
        <article
          key={role.key}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                ROLE_BADGE[role.key] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {role.label}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{role.description}</p>
          <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
            {role.permissions.map((p) => (
              <li key={p.key} className="flex items-start gap-2 text-xs text-slate-700">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                {p.label}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function AddStudentModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          display_name: displayName.trim(),
          email: email.trim() || undefined,
          username: username.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to add student");
      }
      return res.json();
    },
    onSuccess: () => {
      setDisplayName("");
      setEmail("");
      setUsername("");
      setError("");
      onSuccess();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    create.mutate();
  }

  return (
    <Modal title="Add student" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <label className="block text-sm font-medium text-slate-700">
          Full name
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="Priya Sharma"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Email <span className="font-normal text-slate-400">(optional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="priya@school.edu"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Username <span className="font-normal text-slate-400">(for student login)</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="priya.s"
          />
        </label>
        <p className="text-xs text-slate-500">
          Provide at least an email or username. Assign this student to a section in School setup.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending || !displayName.trim()}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {create.isPending ? "Adding…" : "Add student"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
