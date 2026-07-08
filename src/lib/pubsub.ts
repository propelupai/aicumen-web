import { PubSub } from "@google-cloud/pubsub";
import { initGoogleCreds } from "@/lib/google-credentials";
import { gcp, pubsubConfig } from "@/lib/config";

let pubsub: PubSub | null = null;

function getPubSub(): PubSub {
  if (!pubsub) {
    initGoogleCreds();
    pubsub = new PubSub({ projectId: gcp.projectId || undefined });
  }
  return pubsub;
}

/** Best-effort publish — uploads must not fail if the worker topic is not wired yet. */
export async function publishCurriculumDocRequest(documentId: number): Promise<void> {
  const topicName = pubsubConfig.curriculumDocRequests;
  if (!topicName) {
    console.warn("PUBSUB_TOPIC_CURRICULUM_DOC_REQUESTS not set; skipping publish");
    return;
  }
  try {
    await getPubSub()
      .topic(topicName)
      .publishMessage({ json: { document_id: documentId } });
  } catch (err) {
    console.error("Failed to publish curriculum-doc-requests:", err);
  }
}
