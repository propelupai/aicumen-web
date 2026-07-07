import "server-only";
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";

let _auth: Auth | null = null;

/** Lazy Firebase Admin singleton. Reads creds from env; safe across serverless reuse / hot reload. */
export function getAdminAuth(): Auth {
  if (_auth) return _auth;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      `Missing Firebase Admin envs. present = { projectId:${!!FIREBASE_PROJECT_ID}, clientEmail:${!!FIREBASE_CLIENT_EMAIL}, privateKey:${!!FIREBASE_PRIVATE_KEY} }`,
    );
  }

  const apps = getApps();
  const app: App = apps.length
    ? apps[0]
    : initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          // Classic env-var newline bug: stored key has escaped \n, restore real newlines.
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });

  _auth = getAuth(app);
  return _auth!;
}
