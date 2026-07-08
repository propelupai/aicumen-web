export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAuthUser } from "@/lib/getAuthUser";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/rbac";
import { deleteObject } from "@/lib/gcs";
import { deleteRagFile } from "@/lib/rag/delete-rag-file";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  let client;
  try {
    const auth = await getAuthUser(_request);
    requirePermission(auth, "content", "manage");

    const { id } = await context.params;
    const documentId = parseInt(id, 10);
    if (!Number.isInteger(documentId)) {
      return NextResponse.json({ message: "Invalid document id" }, { status: 400 });
    }

    client = await pool.connect();
    const selectResult = await client.query(
      `SELECT d.file_path, rf.rag_file_name
         FROM curriculum_documents d
         LEFT JOIN curriculum_rag_files rf ON rf.document_id = d.id
        WHERE d.id = $1`,
      [documentId],
    );
    if (selectResult.rows.length === 0) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    const { file_path, rag_file_name } = selectResult.rows[0];

    const del = await client.query(
      `DELETE FROM curriculum_documents WHERE id = $1 RETURNING *`,
      [documentId],
    );

    try {
      await deleteObject(file_path as string);
    } catch (gcsErr) {
      console.warn("GCS delete failed (object may not exist):", gcsErr);
    }

    try {
      await deleteRagFile(rag_file_name as string | null);
    } catch (ragErr) {
      console.warn("RagFile delete failed (corpus may be out of sync):", ragErr);
    }

    return NextResponse.json({ message: "Deleted", deleted: del.rows[0] }, { status: 200 });
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error deleting curriculum document");
  } finally {
    if (client) client.release();
  }
}
