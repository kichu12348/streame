import type { FastifyRequest, FastifyReply } from "fastify";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index";
import { uploads } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { videoProcessingQueue } from "../jobs/queue";
import { pipeline } from "node:stream/promises";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "temp");

// Ensure upload dir exists on controller load
fsPromises.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

export type UploadInitBody = {
  filename: string;
  totalChunks: number;
  referenceId: string;
  referenceType: "movie" | "episode";
};

export type UploadCompleteParams = {
  uploadId: string;
};

export async function initUploadHandler(
  req: FastifyRequest<{ Body: UploadInitBody }>,
  reply: FastifyReply
) {
  const { filename, totalChunks, referenceId, referenceType } = req.body;

  if (!filename || !totalChunks || !referenceId || !referenceType) {
    return reply.code(400).send({ error: "Missing required fields" });
  }

  const uploadId = uuidv4();

  await db.insert(uploads).values({
    id: uploadId,
    filename,
    totalChunks,
    referenceId,
    referenceType,
    status: "uploading",
    receivedChunks: 0,
  });

  return reply.send({ uploadId });
}

export async function processChunkHandler(
  req: FastifyRequest<{ Params: UploadCompleteParams }>,
  reply: FastifyReply
) {
  const { uploadId } = req.params;

  const data = await req.file();
  if (!data) {
    return reply.code(400).send({ error: "Missing file payload" });
  }

  const chunkIndexField = data.fields?.chunkIndex;
  const chunkIndex =
    chunkIndexField && "value" in chunkIndexField
      ? Number(chunkIndexField.value)
      : -1;

  if (chunkIndex === -1 || isNaN(chunkIndex)) {
    return reply.code(400).send({ error: "Invalid or missing chunkIndex" });
  }

  const tempFilePath = path.join(UPLOAD_DIR, `${uploadId}.tmp`);

  await pipeline(
    data.file,
    fs.createWriteStream(tempFilePath, { flags: "a" }),
  );

  await db
    .update(uploads)
    .set({ receivedChunks: sql`${uploads.receivedChunks} + 1` })
    .where(eq(uploads.id, uploadId));

  return reply.send({ success: true, chunkIndex });
}

export async function completeUploadHandler(
  req: FastifyRequest<{ Params: UploadCompleteParams }>,
  reply: FastifyReply
) {
  const { uploadId } = req.params;

  const [uploadRecord] = await db
    .select()
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .limit(1);

  if (!uploadRecord) {
    return reply.code(404).send({ error: "Upload record not found" });
  }

  if (uploadRecord.receivedChunks < uploadRecord.totalChunks) {
    return reply.code(400).send({
      error: "Missing chunks",
      expected: uploadRecord.totalChunks,
      received: uploadRecord.receivedChunks,
    });
  }

  await db
    .update(uploads)
    .set({ status: "completed" })
    .where(eq(uploads.id, uploadId));

  const inputFilePath = path.join(UPLOAD_DIR, `${uploadId}.tmp`);

  videoProcessingQueue
    .push({
      uploadId: uploadRecord.id,
      referenceId: uploadRecord.referenceId,
      referenceType: uploadRecord.referenceType as "movie" | "episode",
      inputFilePath,
    })
    .catch((err: unknown) => {
      req.log.error(`Queue error for ${uploadId}: ${err}`);
    });

  return reply.send({
    success: true,
    message: "Upload verified. Video processing has been queued.",
  });
}
