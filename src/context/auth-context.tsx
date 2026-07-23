"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  subscribeToAuthChanges,
  signInWithGoogle,
  signOut,
  deleteFirebaseUserAccount,
  getFirebaseAuthErrorMessage,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  resetPassword,
  linkPasswordToCurrentUser,
  getSignInMethods,
} from "@/lib/firebase";

interface AuthUser {
  firebaseUser: FirebaseUser;
  user_id?: string;
  school_id: number | null;
  role?: string | null;
  school_role_key?: string | null;
  account_type?: string | null;
  platform_role?: string | null;
  display_name?: string;
  photo_url?: string | null;
  school_name?: string | null;
  firebase_uid?: string | null;
}

interface AuthContextProps {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  linkPassword: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

/**
 * Transient backend/network hiccups (intermittent DB/SSL handshake surfacing as
 * 5xx, dropped sockets) are safe to retry and should never reach the user as a
 * red error.
 */
function isTransientAuthError(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? err ?? "");
  if (/^5\d\d:/.test(message)) return true;
  return /SSL|tls alert|ssl_read|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network|timeout|Failed to fetch|socket hang up/i.test(
    message,
  );
}

async function retryOnTransient<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransientAuthError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  const { data: authUser, isLoading: isUserLoading, refetch } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me", firebaseUser?.uid],
    queryFn: async () => {
      let res = await fetch("/api/auth/me", { credentials: "include" });
      // Firebase user exists but the cookie expired (idle/tab resume): re-establish once and retry.
      if (res.status === 401 && firebaseUser) {
        await establishSessionCookie(firebaseUser);
        res = await fetch("/api/auth/me", { credentials: "include" });
      }
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    },
    enabled: !!firebaseUser,
    staleTime: 5 * 60 * 1000,
  });

  async function establishSessionCookie(user: FirebaseUser) {
    const idToken = await user.getIdToken(true); // force refresh
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
  }

  const syncUserMutation = useMutation({
    mutationFn: async (user: FirebaseUser) => {
      const userData = {
        firebase_uid: user.uid,
        email: user.email,
        display_name: user.displayName,
        photo_url: user.photoURL,
      };
      return apiRequest("POST", "/api/auth/sync", userData);
    },
    onSuccess: () => {
      refetch();
    },
    onError: (err: Error) => {
      // The auth-state handler owns user-facing messaging (with retries); just record here.
      setError(err);
    },
  });

  useEffect(() => {
    firebaseUserRef.current = firebaseUser;
  }, [firebaseUser]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      if (!user) {
        setFirebaseUser(null);
        firebaseUserRef.current = null;
        setLoading(false);
        return;
      }

      const alreadySynced = firebaseUserRef.current?.uid === user.uid;

      // Soft-nav bounces (e.g. signup → dashboard before cookie exists → /login)
      // re-subscribe with the same Firebase uid. Never redirect until the
      // session cookie (and DB sync) are confirmed — otherwise proxy sends us
      // back to login.
      if (alreadySynced) {
        if (pathname === "/login" || pathname === "/signup") {
          try {
            await retryOnTransient(async () => {
              await establishSessionCookie(user);
              await syncUserMutation.mutateAsync(user);
            });
            router.replace("/dashboard/home");
          } catch (err: unknown) {
            console.warn(
              "[Auth] Could not re-establish session on login/signup:",
              (err as { message?: string })?.message || err,
            );
          }
        }
        setLoading(false);
        return;
      }

      const isOnLoginSignup = pathname === "/login" || pathname === "/signup";
      const isPublicPage = pathname === "/" || isOnLoginSignup;

      // Only sync on explicit auth attempts (login/signup) or protected pages.
      if (isPublicPage && !isOnLoginSignup) {
        setFirebaseUser(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      firebaseUserRef.current = user;

      try {
        await retryOnTransient(async () => {
          await establishSessionCookie(user);
          await syncUserMutation.mutateAsync(user);
        });

        if (pathname === "/signup" || pathname === "/login") {
          router.replace("/dashboard/home");
        }
      } catch (err: unknown) {
        const message = String((err as { message?: string })?.message || "");
        const isForbidden = message.startsWith("403");

        if (isForbidden) {
          // No pre-seeded row for this account -> not invited. Remove the
          // Firebase account so a later valid signup isn't blocked, then sign out.
          try {
            await deleteFirebaseUserAccount(user);
          } catch (deleteErr) {
            console.warn("[Auth] Could not delete unauthorized Firebase account:", deleteErr);
          }
          await signOut();
          toast({
            title: "Access Denied",
            description: "You are not authorized to use this app. Ask your school admin for a sign-up code.",
            variant: "destructive",
          });
        } else if (isTransientAuthError(err)) {
          console.warn("[Auth] Transient sign-in error after retries:", message || err);
          toast({
            title: "Unable to sign in",
            description: "We couldn't complete your sign-in just now. Please try again in a moment.",
          });
        } else {
          console.error("[Auth] Sign-in failed:", message || err);
          toast({
            title: "Unable to sign in",
            description: "We couldn't complete your sign-in. Please try again.",
            variant: "destructive",
          });
        }

        setFirebaseUser(null);
        firebaseUserRef.current = null;
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code || "");
      const isUserDismissed =
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
      if (!isUserDismissed) {
        console.error("[Auth] Google sign-in failed:", (err as { message?: string })?.message || err);
        toast({
          title: "Unable to sign in",
          description: getFirebaseAuthErrorMessage(err),
          variant: "destructive",
        });
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await fetch("/api/auth/signout", { method: "POST" }); // clears the HttpOnly cookie
      await signOut();
      queryClient.clear();
      // Hard navigation (full document reload) to /login rather than a
      // client-side route change. Firebase preloads its popup resolver on page
      // load; a soft SPA navigation leaves it in a re-initializing state that
      // makes the NEXT signInWithPopup open asynchronously and get blocked by
      // the browser ("works once, then fails"). Reloading guarantees every
      // login attempt starts from a fresh, popup-ready document.
      window.location.assign("/login");
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      toast({ title: "Sign Out Error", description: "Could not sign out", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleSignInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const methods = await getSignInMethods(email);
      if (methods.length && !methods.includes("password")) {
        throw new Error(
          "This email is registered with Google. Please sign in with Google, then add a password from your profile.",
        );
      }
      await signInWithEmailPassword(email, password); // onAuthStateChanged handles the rest
    } catch (err: unknown) {
      const friendly = getFirebaseAuthErrorMessage(err);
      const wrapped = new Error(friendly);
      setError(wrapped);
      toast({ title: "Sign In Error", description: friendly, variant: "destructive" });
      throw wrapped;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signUpWithEmailPassword(email, password);
    } catch (err: unknown) {
      const friendly = getFirebaseAuthErrorMessage(err);
      const wrapped = new Error(friendly);
      setError(wrapped);
      toast({ title: "Sign Up Error", description: friendly, variant: "destructive" });
      throw wrapped;
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    await resetPassword(email);
    toast({ title: "Password reset sent", description: "Check your inbox for the reset link." });
  };

  const handleLinkPassword = async (email: string, password: string) => {
    await linkPasswordToCurrentUser(email, password);
    toast({ title: "Password added", description: "You can now sign in with email & password." });
  };

  const user: AuthUser | null =
    firebaseUser && authUser
      ? {
          firebaseUser,
          user_id: authUser.user_id,
          school_id: authUser.school_id,
          role: authUser.role ?? null,
          school_role_key: authUser.school_role_key ?? null,
          account_type: authUser.account_type ?? "teacher",
          platform_role: authUser.platform_role ?? null,
          display_name: authUser.display_name,
          photo_url: authUser.photo_url ?? undefined,
          school_name: authUser.school_name ?? null,
          firebase_uid: authUser.firebase_uid ?? firebaseUser.uid ?? null,
        }
      : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: loading || isUserLoading,
        error,
        signIn: handleSignIn,
        signOut: handleSignOut,
        signInWithEmail: handleSignInWithEmail,
        signUpWithEmail: handleSignUpWithEmail,
        sendPasswordReset: handleSendPasswordReset,
        linkPassword: handleLinkPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
