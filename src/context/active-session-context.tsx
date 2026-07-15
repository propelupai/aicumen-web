"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** A live teaching session the teacher can resume from anywhere until ended. */
export type ActiveSession = {
  activityId: number;
  sectionId: number | null;
  title: string;
  emoji: string;
  questCode: string;
  /** "stem" | "coach" | "extend" | "done" */
  phase: string;
  coachIndex: number;
  totalCoachSteps: number;
  startedAt: number;
};

type ActiveSessionContextValue = {
  activeSession: ActiveSession | null;
  /** True once localStorage has been read on the client. */
  hydrated: boolean;
  startSession: (session: ActiveSession) => void;
  updateSession: (patch: Partial<ActiveSession>) => void;
  endSession: () => void;
};

const STORAGE_KEY = "aicumen.activeSession.v1";

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveSession;
        if (parsed && Number.isInteger(parsed.activityId)) {
          setActiveSession(parsed);
        }
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (activeSession) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [activeSession, hydrated]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue) {
        setActiveSession(null);
        return;
      }
      try {
        setActiveSession(JSON.parse(e.newValue) as ActiveSession);
      } catch {
        // ignore
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const startSession = useCallback((session: ActiveSession) => {
    setActiveSession(session);
  }, []);

  const updateSession = useCallback((patch: Partial<ActiveSession>) => {
    setActiveSession((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const endSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  return (
    <ActiveSessionContext.Provider
      value={{ activeSession, hydrated, startSession, updateSession, endSession }}
    >
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession(): ActiveSessionContextValue {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) {
    throw new Error("useActiveSession must be used within an ActiveSessionProvider");
  }
  return ctx;
}
