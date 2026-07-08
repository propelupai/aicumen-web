import { Storage } from "@google-cloud/storage";
import { initGoogleCreds } from "@/lib/google-credentials";
import { gcp } from "@/lib/config";

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    initGoogleCreds();
    storage = new Storage();
  }
  return storage;
}

export function getCurriculumBucketName(): string {
  const name = gcp.curriculumBucket;
  if (!name) throw new Error("Missing CURRICULUM_GCS_BUCKET");
  return name;
}

export function getCurriculumBucket() {
  return getStorage().bucket(getCurriculumBucketName());
}

export async function uploadObject(
  objectName: string,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<void> {
  const blob = getCurriculumBucket().file(objectName);
  await blob.save(buffer, {
    resumable: false,
    contentType,
    metadata: metadata ? { metadata } : undefined,
  });
}

export async function signedReadUrl(objectName: string, ttlMs = 60 * 60 * 1000): Promise<string> {
  const blob = getCurriculumBucket().file(objectName);
  try {
    const [url] = await blob.getSignedUrl({
      action: "read",
      expires: Date.now() + ttlMs,
    });
    return url;
  } catch {
    return `https://storage.googleapis.com/${getCurriculumBucketName()}/${objectName}`;
  }
}

export async function deleteObject(objectName: string): Promise<void> {
  await getCurriculumBucket().file(objectName).delete({ ignoreNotFound: true });
}

export function curriculumUploadPath(
  documentId: number | "pending",
  filename: string,
): string {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `curriculum_uploads/${documentId}/${timestamp}_${safeName}`;
}
