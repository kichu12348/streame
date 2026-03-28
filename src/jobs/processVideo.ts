import ffmpeg from "fluent-ffmpeg";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { db } from "../db/index";
import { movies, episodes } from "../db/schema";
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
  const outputDir = path.join(process.cwd(), "uploads", "processed", referenceId);
  const subsDir = path.join(outputDir, "subs");
  const audiosDir = path.join(outputDir, "audios");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(subsDir, { recursive: true });
  await fs.mkdir(audiosDir, { recursive: true });

  const videoOutput = path.join(outputDir, "video.mp4");

  const extractedSubs: string[] = [];
  const extractedAudios: string[] = [];

  try {
    console.log(`[Worker] Probing video for ${referenceType} ${referenceId}...`);
    const metadata = await probeVideo(inputFilePath);
    
    // Group streams by codec type
    const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');
    const subtitleStreams = metadata.streams.filter(s => s.codec_type === 'subtitle');

    // 1. Extract ALL Subtitles dynamically
    for (let i = 0; i < subtitleStreams.length; i++) {
        const stream = subtitleStreams[i];
        if (!stream) continue;
        // Safely extract language tag, default to tracking index
        const lang = stream.tags?.language || `track_${i}`;
        const filename = `subtitles_${lang}.vtt`;
        const subtitleOutput = path.join(subsDir, filename);
        console.log(`[Worker] Extracting subtitle (${lang}) for ${referenceType} ${referenceId}...`);
        
        await runFfmpeg(
            ffmpeg(inputFilePath)
            // Use stream.index (-map 0:X) to isolate specific stream reliably
            .outputOptions([`-map 0:${stream.index}`, "-c:s webvtt"])
            .save(subtitleOutput)
        ).then(() => {
            extractedSubs.push(filename);
        }).catch((err: Error) => console.warn(`[Worker] Warning: Failed to extract subtitle ${lang}:`, err.message));
    }

    // 2. Extract ALL Audio Streams dynamically
    for (let i = 0; i < audioStreams.length; i++) {
        const stream = audioStreams[i];
        if (!stream) continue;
        const lang = stream.tags?.language || `track_${i}`;
        const filename = `audio_${lang}.aac`;
        const audioOutput = path.join(audiosDir, filename);
        console.log(`[Worker] Extracting audio (${lang}) for ${referenceType} ${referenceId}...`);
        
        await runFfmpeg(
            ffmpeg(inputFilePath)
            .outputOptions([`-map 0:${stream.index}`, "-vn", "-c:a aac"])
            .save(audioOutput)
        ).then(() => {
            extractedAudios.push(filename);
        }).catch((err: Error) => console.warn(`[Worker] Warning: Failed to extract audio ${lang}:`, err.message));
    }

    // 3. Transcode to MP4 (Web Compatible)
    console.log(`[Worker] Transcoding video to MP4 for ${referenceType} ${referenceId}...`);
    await runFfmpeg(
      ffmpeg(inputFilePath)
        .outputOptions([
          "-map 0:v:0",    // Force map the main video track
          "-map 0:a:0?",   // Map main audio track if it exists
          "-c:v libx264",
          "-preset fast",
          "-c:a aac",
          "-movflags +faststart"
        ])
        .save(videoOutput)
    );

    // 4. Update status to 'ready'
    console.log(`[Worker] Update DB status to ready for ${referenceType} ${referenceId}`);
    if (referenceType === "movie") {
      await db.update(movies)
        .set({ status: "ready", subtitles: extractedSubs, audios: extractedAudios })
        .where(eq(movies.id, referenceId));
    } else if (referenceType === "episode") {
      await db.update(episodes)
        .set({ status: "ready", subtitles: extractedSubs, audios: extractedAudios })
        .where(eq(episodes.id, referenceId));
    }

    // Cleanup: Remove the temporary uploaded file
    await fs.unlink(inputFilePath).catch(console.error);
    console.log(`[Worker] Finished processing for ${referenceType} ${referenceId}`);
  } catch (err) {
    console.error(`[Worker] Error processing video for ${referenceType} ${referenceId}:`, err);
    throw err;
  }
};

const runFfmpeg = (command: ffmpeg.FfmpegCommand): Promise<void> => {
  return new Promise((resolve, reject) => {
    command
      .on("end", () => resolve())
      .on("error", (err) => reject(err));
  });
};
