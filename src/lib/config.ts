function optional(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

export const gcp = {
  projectId: optional("GOOGLE_PROJECT_ID"),
  curriculumBucket: optional("CURRICULUM_GCS_BUCKET"),
  ragLocation: optional("RAG_LOCATION", "us-central1"),
};

export const pubsubConfig = {
  curriculumDocRequests: optional("PUBSUB_TOPIC_CURRICULUM_DOC_REQUESTS", "curriculum-doc-requests"),
};
