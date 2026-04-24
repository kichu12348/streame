import ffmpeg from "fluent-ffmpeg";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { db } from "../db/index";
import { movies, episodes, uploads } from "../db/schema";
import { eq } from "drizzle-orm";

export interface ProcessVideoTask {
  uploadId: string;
  referenceId: string;
  referenceType: "movie" | "episode";
  inputFilePath: string;
}

const probeVideo = (filePath: string): Promise<ffmpeg.FfprobeData> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
};

export const processVideo = async (task: ProcessVideoTask): Promise<void> => {
  const { uploadId, referenceId, referenceType, inputFilePath } = task;
  const outputDir = path.join(
    process.cwd(),
    "uploads",
    "processed",
    referenceId,
  );
  const subsDir = path.join(outputDir, "subs");
  const hlsDir = path.join(outputDir, "hls");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(subsDir, { recursive: true });
  await fs.mkdir(hlsDir, { recursive: true });

  const extractedSubs: string[] = [];

  try {
    console.log(
      `[Worker] Probing video for ${referenceType} ${referenceId}...`,
    );
    const metadata = await probeVideo(inputFilePath);

    // Group streams by codec type
    const subtitleStreams = metadata.streams.filter(
      (s) => s.codec_type === "subtitle",
    );
    const audioStreams = metadata.streams.filter(
      (s) => s.codec_type === "audio",
    );

    // 1. Extract ALL Subtitles dynamically
    for (let i = 0; i < subtitleStreams.length; i++) {
      const stream = subtitleStreams[i];
      if (!stream) continue;
      // Safely extract language tag, default to tracking index
      const lang = stream.tags?.language || `track_${i}`;
      const filename = `subtitles_${lang}.vtt`;
      const subtitleOutput = path.join(subsDir, filename);

      await runFfmpeg(
        ffmpeg(inputFilePath)
          // Use stream.index (-map 0:X) to isolate specific stream reliably
          .outputOptions([`-map 0:${stream.index}`, "-c:s webvtt"])
          .save(subtitleOutput),
      )
        .then(() => {
          extractedSubs.push(filename);
        })
        .catch((err: Error) =>
          console.warn(
            `[Worker] Warning: Failed to extract subtitle ${lang}:`,
            err.message,
          ),
        );
    }

    const ffmpegOptions = [
      "-c:v libx264",
      "-preset fast",
      "-f hls",
      "-hls_time 10",
      "-hls_playlist_type vod",
      "-master_pl_name",
      "playlist.m3u8",
      "-hls_segment_filename",
      path.join(hlsDir, "v%v_segment_%03d.ts").replace(/\\/g, "/"),
    ];

    ffmpegOptions.push("-map", "0:v:0");
    let varStreamMap = "";

    if (audioStreams.length > 0) {
      ffmpegOptions.push("-c:a", "aac");
      varStreamMap = "v:0,agroup:audio";
      audioStreams.forEach((stream, idx) => {
        ffmpegOptions.push("-map", `0:${stream.index}`);
        const lang = stream.tags?.language || `track${idx}`;
        const defaultFlag = idx === 0 ? ",default:yes" : "";
        varStreamMap += ` a:${idx},agroup:audio,language:${lang},name:${lang}${defaultFlag}`;
      });
    } else {
      varStreamMap = "v:0";
    }

    ffmpegOptions.push("-var_stream_map", varStreamMap.trim());

    await runFfmpeg(
      ffmpeg(inputFilePath)
        .outputOptions(ffmpegOptions)
        .save(path.join(hlsDir, "v%v_stream.m3u8")),
    );

    if (referenceType === "movie") {
      await db
        .update(movies)
        .set({ status: "ready", subtitles: extractedSubs })
        .where(eq(movies.id, referenceId));
    } else if (referenceType === "episode") {
      await db
        .update(episodes)
        .set({ status: "ready", subtitles: extractedSubs })
        .where(eq(episodes.id, referenceId));
    }

    // Cleanup: Remove the temporary uploaded file
    await fs.unlink(inputFilePath).catch(console.error);
  } catch (err) {
    // on error delete the output directory to clean up any partial files
    try {
      await fs
        .rm(outputDir, { recursive: true, force: true })
        .catch(console.error);
      // remove the temporary uploaded file
      await fs.unlink(inputFilePath).catch(console.error);
      // remove the database entry for this upload if it exists
      if (referenceType === "movie") {
        const movie = await db.query.movies.findFirst({
          where: eq(movies.id, referenceId),
        });
        if (movie) {
          await db
            .delete(movies)
            .where(eq(movies.id, referenceId))
            .catch(console.error);
          const coverImgName = movie.coverImage.split("/").pop();
          if (coverImgName) {
            const coverImgPath = path.join(
              process.cwd(),
              "uploads",
              "covers",
              coverImgName,
            );
            await fs.unlink(coverImgPath).catch(console.error);
          }
        }
      } else if (referenceType === "episode") {
        const episode = await db.query.episodes.findFirst({
          where: eq(episodes.id, referenceId),
        });
        if (episode) {
          await db
            .delete(episodes)
            .where(eq(episodes.id, referenceId))
            .catch(console.error);
        }
      }

      await db
        .delete(uploads)
        .where(eq(uploads.id, uploadId))
        .catch(console.error);
    } catch (err) {
      console.error(
        `[Worker] Error during cleanup for ${referenceType} ${referenceId}:`,
        err,
      );
    }
    console.error(
      `[Worker] Error processing video for ${referenceType} ${referenceId}:`,
      err,
    );
    throw err;
  }
};

const runFfmpeg = (command: ffmpeg.FfmpegCommand): Promise<void> => {
  return new Promise((resolve, reject) => {
    command.on("end", () => resolve()).on("error", (err) => reject(err));
  });
};
