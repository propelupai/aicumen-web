export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";
import {
  CURRICULUM_ALLOWED_EXTENSIONS_LABEL,
  CURRICULUM_ALLOWED_MIME_TYPES,
  CURRICULUM_DOC_KINDS,
  type CurriculumDocKind,
  MAX_CURRICULUM_FILE_SIZE,
  formatBytes,
} from "@/lib/curriculum-upload";
import { curriculumUploadPath, signedReadUrl, uploadObject } from "@/lib/gcs";
import { publishCurriculumDocRequest } from "@/lib/pubsub";

export async function GET(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    client = await pool.connect();
    const result = await client.query(
      `SELECT d.*,
              s.name AS subject_name,
              p.status AS processing_status,
              p.error_message AS processing_error,
              p.stats AS processing_stats,
              rf.rag_file_name,
              rf.status AS rag_status
         FROM curriculum_documents d
         LEFT JOIN subjects s ON s.id = d.subject_id
         LEFT JOIN LATERAL (
           SELECT status, error_message, stats
             FROM curriculum_document_processing
            WHERE document_id = d.id
            ORDER BY updated_at DESC NULLS LAST, id DESC
            LIMIT 1
         ) p ON true
         LEFT JOIN curriculum_rag_files rf ON rf.document_id = d.id
        ORDER BY d.created_at DESC`,
    );

    const items = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        file_url: await signedReadUrl(row.file_path as string),
        is_ingested:
          row.processing_status === "ready_for_review" ||
          row.processing_status === "reviewed" ||
          row.rag_status === "indexed",
      })),
    );

    return NextResponse.json(items, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error listing curriculum documents");
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: NextRequest) {
  let client;
  try {
    const auth = await getAuthUser(request);
    requirePermission(auth, "content", "manage");

    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const docKind = String(form.get("doc_kind") ?? "other").trim() as CurriculumDocKind;
    const descriptionRaw = form.get("description");
    const description = descriptionRaw == null ? null : String(descriptionRaw).trim() || null;
    const subjectIdRaw = form.get("subject_id");
    const gradeRaw = form.get("grade");
    const subjectId = subjectIdRaw ? parseInt(String(subjectIdRaw), 10) : null;
    const grade = gradeRaw ? parseInt(String(gradeRaw), 10) : null;

    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 });
    }
    if (!CURRICULUM_DOC_KINDS.includes(docKind)) {
      return NextResponse.json({ message: "Invalid document kind" }, { status: 400 });
    }

    const fileEntry = form.get("file");
    if (!fileEntry || typeof (fileEntry as Blob).arrayBuffer !== "function") {
      return NextResponse.json({ message: "A file upload is required" }, { status: 400 });
    }
    const fileBlob = fileEntry as File;

    if (fileBlob.size > MAX_CURRICULUM_FILE_SIZE) {
      return NextResponse.json(
        {
          message: `File too large (${formatBytes(fileBlob.size)}). Maximum is ${formatBytes(MAX_CURRICULUM_FILE_SIZE)}.`,
        },
        { status: 413 },
      );
    }
    if (fileBlob.type && !CURRICULUM_ALLOWED_MIME_TYPES.has(fileBlob.type)) {
      return NextResponse.json(
        { message: `File type not allowed. Accepted: ${CURRICULUM_ALLOWED_EXTENSIONS_LABEL}.` },
        { status: 415 },
      );
    }

    const arrayBuf = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const objectName = curriculumUploadPath("pending", fileBlob.name);

    client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertResult = await client.query(
        `INSERT INTO curriculum_documents
           (title, filename, file_path, subject_id, grade, doc_kind, description,
            uploaded_by, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          title,
          fileBlob.name,
          objectName,
          Number.isInteger(subjectId) ? subjectId : null,
          Number.isInteger(grade) ? grade : null,
          docKind,
          description,
          auth.user_id,
          fileBlob.size,
          fileBlob.type || null,
        ],
      );

      const record = insertResult.rows[0];
      const documentId = record.id as number;

      await uploadObject(objectName, buffer, fileBlob.type || "application/octet-stream", {
        document_id: String(documentId),
        uploaded_by: auth.user_id,
      });

      await client.query(
        `INSERT INTO curriculum_document_processing (document_id, status, doc_fingerprint)
         VALUES ($1, 'uploaded', '')
         ON CONFLICT (document_id, doc_fingerprint) DO UPDATE
           SET status = 'uploaded', updated_at = NOW()`,
        [documentId],
      );

      await client.query("COMMIT");

      await publishCurriculumDocRequest(documentId);

      const fileUrl = await signedReadUrl(objectName);
      return NextResponse.json({ ...record, file_url: fileUrl }, { status: 201 });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error uploading curriculum document");
  } finally {
    if (client) client.release();
  }
}
