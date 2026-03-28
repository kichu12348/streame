import type { FastifyRequest, FastifyReply } from "fastify";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

export type MediaIdParams = { id: string };
export type MediaFileParams = { id: string; file: string };

async function streamMedia(
  req: FastifyRequest,
  reply: FastifyReply,
  filePath: string,
  contentType: string,
) {
  try {
    const stat = await fsp.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (typeof range === "string") {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0] as string, 10);
      const endStr = parts[1];
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      if (start >= fileSize) {
        reply
          .status(416)
          .send(
            "Requested range not satisfiable\n" + start + " >= " + fileSize,
          );
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      reply
        .status(206)
        .header("Content-Range", `bytes ${start}-${end}/${fileSize}`)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", chunksize)
        .header("Content-Type", contentType);

      return reply.send(file);
    } else {
      reply
        .status(200)
        .header("Content-Length", fileSize)
        .header("Content-Type", contentType);
      return reply.send(fs.createReadStream(filePath));
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      reply.status(404).send({ error: "File not found" });
    } else {
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}

export async function streamMovieHandler(
  req: FastifyRequest<{ Params: MediaIdParams }>,
  reply: FastifyReply,
) {
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "video.mp4",
  );
  await streamMedia(req, reply, filePath, "video/mp4");
}

export async function streamMovieHlsHandler(
  req: FastifyRequest<{ Params: MediaFileParams }>,
  reply: FastifyReply,
) {
  const file = path.basename(req.params.file);
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "hls",
    file,
  );

  const ext = path.extname(file).toLowerCase();
  let contentType = "application/octet-stream";
  if (ext === ".m3u8") contentType = "application/vnd.apple.mpegurl";
  else if (ext === ".ts") contentType = "video/mp2t";

  await streamMedia(req, reply, filePath, contentType);
}

export async function streamMovieSubsHandler(
  req: FastifyRequest<{ Params: MediaFileParams }>,
  reply: FastifyReply,
) {
  const file = path.basename(req.params.file);
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "subs",
    file,
  );
  await streamMedia(req, reply, filePath, "text/vtt");
}

export async function streamMovieAudiosHandler(
  req: FastifyRequest<{ Params: MediaFileParams }>,
  reply: FastifyReply,
) {
  const file = path.basename(req.params.file);
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "audios",
    file,
  );
  await streamMedia(req, reply, filePath, "audio/aac");
}

export async function streamEpisodeHandler(
  req: FastifyRequest<{ Params: MediaIdParams }>,
  reply: FastifyReply,
) {
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "video.mp4",
  );
  await streamMedia(req, reply, filePath, "video/mp4");
}

export async function streamEpisodeHlsHandler(
  req: FastifyRequest<{ Params: MediaFileParams }>,
  reply: FastifyReply,
) {
  const file = path.basename(req.params.file);
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "hls",
    file,
  );

  const ext = path.extname(file).toLowerCase();
  let contentType = "application/octet-stream";
  if (ext === ".m3u8") contentType = "application/vnd.apple.mpegurl";
  else if (ext === ".ts") contentType = "video/mp2t";

  await streamMedia(req, reply, filePath, contentType);
}

export async function streamEpisodeSubsHandler(
  req: FastifyRequest<{ Params: MediaFileParams }>,
  reply: FastifyReply,
) {
  const file = path.basename(req.params.file);
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "subs",
    file,
  );
  await streamMedia(req, reply, filePath, "text/vtt");
}

export async function streamEpisodeAudiosHandler(
  req: FastifyRequest<{ Params: MediaFileParams }>,
  reply: FastifyReply,
) {
  const file = path.basename(req.params.file);
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "processed",
    req.params.id,
    "audios",
    file,
  );
  await streamMedia(req, reply, filePath, "audio/aac");
}
