import fastq from "fastq";
import type { queueAsPromised } from "fastq";
import { processVideo } from "./processVideo";
import type { ProcessVideoTask } from "./processVideo";

// We set concurrency to 1 to ensure system resources (CPU)
// are not fully saturated by multiple simultaneous FFmpeg transcoding processes.
export const videoProcessingQueue: queueAsPromised<ProcessVideoTask> =
  fastq.promise(processVideo, 1);
