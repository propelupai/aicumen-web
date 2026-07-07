"use client";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
  AuthError,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  deleteUser as firebaseDeleteUser,
} from "firebase/auth";

// Public web app config for the `aicumen-dev` Firebase project. This is NOT a
// secret — Firebase web config is safe to ship to the browser. Server-side
// secrets (Admin SDK key, DB creds) live in .env.local instead.
const firebaseConfig = {
  apiKey: "AIzaSyCDlcmA6Xz5E3Nd7DubPmIwhwk72fuAgHM",
  authDomain: "aicumen-dev.firebaseapp.com",
  projectId: "aicumen-dev",
  storageBucket: "aicumen-dev.firebasestorage.app",
  messagingSenderId: "144909203173",
  appId: "1:144909203173:web:cdcaaae450aecafb0ec60c",
};

// Initialize once (survives hot reload / repeated imports).
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Persist the session in the browser so a refresh keeps the user signed in.
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch((e) =>
    console.warn("Could not set persistence:", e),
  );
}

const googleProvider = new GoogleAuthProvider();

// Google sign-in via popup (matches the proven PropelUp implementation).
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

/** Remove a Firebase Auth account (e.g. an unauthorized sign-in) so a later signup isn't blocked. */
export async function deleteFirebaseUserAccount(user: FirebaseUser) {
  await firebaseDeleteUser(user);
}

export const signOut = async () => {
  await firebaseSignOut(auth);
  return true;
};

export const subscribeToAuthChanges = (
  callback: (user: FirebaseUser | null) => void,
) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = () => auth.currentUser;

export async function signUpWithEmailPassword(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

/** Add a password to an account that signed in with Google. */
export async function linkPasswordToCurrentUser(email: string, password: string) {
  if (!auth.currentUser) throw new Error("No signed-in user to link");
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(auth.currentUser, credential);
  return result.user;
}

export async function getSignInMethods(email: string) {
  return fetchSignInMethodsForEmail(auth, email);
}

/** User-facing copy for Firebase Auth failures (avoids raw `Firebase: Error (auth/...)` strings). */
export function getFirebaseAuthErrorMessage(error: unknown): string {
  const raw =
    error && typeof error === "object" && "code" in error && typeof (error as AuthError).code === "string"
      ? (error as AuthError).code
      : "";
  const fromMessage =
    !raw && error instanceof Error ? error.message.match(/auth\/[a-z0-9-]+/i)?.[0] ?? "" : "";
  const code = raw || fromMessage;

  const byCode: Record<string, string> = {
    "auth/invalid-credential":
      "That email or password doesn't match our records. Double-check what you entered, try Forgot password, or sign up if you're new here.",
    "auth/user-not-found":
      "We couldn't find an account with that email. Check the spelling or sign up to create one.",
    "auth/wrong-password": "That password isn't correct. Try again or use Forgot password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-disabled": "This account has been disabled. Contact support if you need help.",
    "auth/too-many-requests": "Too many sign-in attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "Please check your internet connection and try again.",
    "auth/email-already-in-use": "That email is already registered. Try signing in instead.",
    "auth/weak-password": "Please choose a stronger password — make it longer and harder to guess.",
    "auth/operation-not-allowed": "This sign-in method isn't available right now. Please contact support.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Please allow pop-ups for this site and try again.",
    "auth/popup-closed-by-user": "The sign-in window was closed before finishing. Please try again.",
    "auth/cancelled-popup-request": "The sign-in window was closed before finishing. Please try again.",
  };

  if (code && byCode[code]) return byCode[code];

  if (error instanceof Error) {
    const msg = error.message;
    if (msg && !msg.includes("Firebase: Error (auth/")) return msg;
  }

  return "Something went wrong. Please try again.";
}
