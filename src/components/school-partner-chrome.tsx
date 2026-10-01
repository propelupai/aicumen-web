"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Headset, Loader2, Mail, MessageSquare, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { hasDedicatedPoc, hasPartnerBadge } from "@/lib/school-partner";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/context/brand-context";

const BADGE_IMAGE = "/badges/founding-partner-2026.png";

/**
 * Partner seal. "seal" = image only (header); "banner" = thin full-width
 * colored strip (top of home page).
 */
export function PartnerBadge({
  variant = "seal",
  className = "",
}: {
  variant?: "seal" | "banner";
  className?: string;
}) {
  const { user } = useAuth();
  const { name: brandName } = useBrand();
  if (!user || !hasPartnerBadge(user)) return null;

  if (variant === "seal") {
    return (
      <img
        src={BADGE_IMAGE}
        alt={user.partner_label ?? "Founding Partner School"}
        title={user.partner_label ?? undefined}
        className={`h-9 w-9 shrink-0 select-none ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-gradient-to-r from-teal-900 to-teal-700 px-4 py-2 shadow-sm ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-amber-300/60">
        <img src={BADGE_IMAGE} alt="" className="h-8 w-8 select-none" draggable={false} />
      </span>
      <p className="min-w-0 truncate text-sm font-semibold text-white">{user.partner_label}</p>
      <p className="ml-auto hidden shrink-0 text-xs font-semibold tracking-wider text-amber-300 uppercase sm:block">
        {brandName} Partner Program
      </p>
    </div>
  );
}

/**
 * Feedback modal. Rendered via portal to <body> so ancestor styles (e.g. the
 * header's backdrop-filter, which creates a containing block for fixed
 * elements) cannot clip or offset it. Body scroll is locked while open.
 * Every submit stores a new timestamped row server-side.
 */
export function FeedbackDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { toast } = useToast();
  const { name: brandName } = useBrand();
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setMessage("");
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  // Lock page scroll behind the modal.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/school/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), page_path: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save feedback");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Feedback saved",
        description: `Thanks! Your note is stored with the ${brandName} team. Send another anytime.`,
      });
      setMessage("");
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/40">
      <button
        type="button"
        className="fixed inset-0 cursor-default"
        aria-label="Close feedback"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="relative z-10 my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="feedback-title" className="text-base font-semibold text-slate-900">
                Share feedback
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tell us what would help your teachers. We store every note for the {brandName} team.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="What should we improve or add?"
            className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!message.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send feedback
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Gusto-style dedicated advisor control for schools with PoC fields set. */
export function DedicatedAdvisorButton() {
  const { user } = useAuth();
  const { name: brandName } = useBrand();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user || !hasDedicatedPoc(user)) return null;

  const title = user.poc_title?.trim() || "Your dedicated advisor";

  return (
    <>
      <div ref={rootRef} className="relative">
        {/* Compact trigger (Gusto-style): advisor details only appear on click. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Your ${brandName} contact`}
          title={`Your ${brandName} contact`}
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            open
              ? "border-teal-300 bg-teal-50 text-teal-900"
              : "border-teal-200 bg-teal-50/50 text-teal-800 hover:border-teal-300 hover:bg-teal-50"
          }`}
        >
          <Headset className="h-3.5 w-3.5" />
          Contact
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            id={panelId}
            role="dialog"
            aria-label={title}
            className="absolute top-full right-0 z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <UserAvatar name={user.poc_name!} photoUrl={null} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{user.poc_name}</p>
                <p className="truncate text-xs text-slate-500">{title}</p>
              </div>
            </div>
            <a
              href={`mailto:${user.poc_email}`}
              className="mt-3 flex items-center gap-2 text-sm text-teal-800 hover:underline"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user.poc_email}</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFeedbackOpen(true);
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Leave feedback
            </button>
          </div>
        )}
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
