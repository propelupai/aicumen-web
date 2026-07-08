import { GoogleAuth } from "google-auth-library";
import { initGoogleCreds } from "@/lib/google-credentials";
import { gcp } from "@/lib/config";

const ragAuth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

/** Best-effort hard delete of a RagFile from its corpus. No-op if name is empty. */
export async function deleteRagFile(ragFileName: string | null | undefined): Promise<void> {
  if (!ragFileName) return;

  initGoogleCreds();

  const client = await ragAuth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain GCP access token");

  const location = gcp.ragLocation || "us-central1";
  const url = `https://${location}-aiplatform.googleapis.com/v1/${ragFileName}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`RagFile delete failed ${res.status}: ${await res.text()}`);
  }
}
