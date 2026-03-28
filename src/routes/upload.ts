import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import {
  initUploadHandler,
  processChunkHandler,
  completeUploadHandler,
  uploadCoverHandler,
} from "../controllers/upload.controller";

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } });

  fastify.post("/init", initUploadHandler);
  fastify.post("/chunk/:uploadId", processChunkHandler);
  fastify.post("/complete/:uploadId", completeUploadHandler);
  fastify.post("/cover", uploadCoverHandler);
}
