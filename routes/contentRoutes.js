const express = require("express");
const router = express.Router();
const { pipeline } = require('stream/promises');
const Movie = require("../models/Movie");
const Series = require("../models/Series");
const fs = require("fs");
const path = require("path");
const e = require("express");
const { console } = require("inspector");

const UPLOAD_PATH = path.join(__dirname, "../uploads");
const TEMP_PATH = path.join(__dirname, "../temp");
const COVERS_PATH = path.join(__dirname, "../public/covers");

const mimeTypes = {
  mkv: "video/x-matroska",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  "3gp": "video/3gpp",
  ts: "video/mp2t",
};

// Add these constants at the top
const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB max file size

// Ensure upload directory exists
[UPLOAD_PATH, TEMP_PATH, COVERS_PATH].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const deleteFolderRecursive = function (directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
};

// Store active uploads
const activeUploads = new Map();

router.post("/upload-cover", async (req, res) => {
  try {
    if (!req.files || !req.files.cover) {
      return res
        .status(400)
        .json({ success: false, error: "No cover image provided" });
    }

    const cover = req.files.cover;
    const coverName = `cover_${Date.now()}${path.extname(cover.name)}`;
    const coverPath = path.join(COVERS_PATH, coverName);

    await cover.mv(coverPath);
    res.json({ success: true, coverPath: `/covers/${coverName}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/upload-chunk", async (req, res) => {
  try {
    const {
      chunkIndex,
      totalChunks,
      fileId,
      type,
      title,
      seasonNumber,
      episodeNumber,
      episodeTitle,
      coverPath,
      totalFileSize // Add this parameter
    } = req.body;

    // Validate file size
    if (totalFileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        success: false, 
        error: "File size exceeds maximum allowed (10GB)" 
      });
    }

    if (!req.files || !req.files.file) {
      return res.status(400).json({ 
        success: false, 
        error: "No chunk provided" 
      });
    }

    const chunk = req.files.file;
    const currentIndex = parseInt(chunkIndex);
    const total = parseInt(totalChunks);

    // Validate chunk size
    if (chunk.size > MAX_CHUNK_SIZE) {
      return res.status(400).json({
        success: false,
        error: "Chunk size exceeds maximum allowed (5MB)"
      });
    }

    // Create or get upload session with error handling
    if (!activeUploads.has(fileId)) {
      try {
        const tempDir = path.join(TEMP_PATH, fileId);
        fs.mkdirSync(tempDir, { recursive: true });
        activeUploads.set(fileId, {
          chunks: new Set(),
          tempDir,
          type,
          title,
          seasonNumber,
          episodeNumber,
          episodeTitle,
          coverPath,
          totalSize: 0
        });
      } catch (error) {
        console.error('Error creating upload session:', error);
        return res.status(500).json({
          success: false,
          error: "Failed to initialize upload session"
        });
      }
    }

    const upload = activeUploads.get(fileId);
    const chunkPath = path.join(upload.tempDir, `chunk-${currentIndex}`);

    try {
      // Save chunk with error handling
      await chunk.mv(chunkPath);
      upload.chunks.add(currentIndex);
      upload.totalSize += chunk.size;

      // Check total uploaded size
      if (upload.totalSize > MAX_FILE_SIZE) {
        deleteFolderRecursive(upload.tempDir);
        activeUploads.delete(fileId);
        return res.status(400).json({
          success: false,
          error: "Total upload size exceeds maximum allowed"
        });
      }

      // If upload is complete
      if (upload.chunks.size === total) {
        const ext = path.extname(chunk.name) || ".mp4";
        const finalFilename = type === "movie"
          ? `movie_${Date.now()}${ext}`
          : `series_${Date.now()}_s${seasonNumber}e${episodeNumber}${ext}`;
        const finalPath = path.join(UPLOAD_PATH, finalFilename);

        try {
          // New chunk combination process
          await combineChunks(upload.chunks, upload.tempDir, finalPath, total);
          console.log('File combination complete:', finalPath);

          // Verify file exists and has content
          const stats = await fs.promises.stat(finalPath);
          if (stats.size === 0) {
            throw new Error('Final file is empty');
          }
          // Save to database before cleanup
          if (type === "movie") {
            try {
              const newMovie = new Movie({
                title,
                filePath: finalFilename,
                coverImage: coverPath,
              });
              const savedMovie = await newMovie.save();
              // Clean up
              deleteFolderRecursive(upload.tempDir);
              activeUploads.delete(fileId);

              // Modified response
              return res.json({ 
                success: true, 
                completed: true,
                movieId: savedMovie._id,
                message: 'Movie upload complete',
                redirect: '/browse.html'
              });
            } catch (dbError) {
              console.log('Database error:', dbError.message);
              // If database save fails, cleanup file
              fs.unlinkSync(finalPath);
              throw new Error('Failed to save to database: ' + dbError.message);
            }
          } else {
            // Similar changes for series upload...
            // ...existing series upload code...
            try {
              let series = await Series.findOne({ title });
              if (!series) {
                series = new Series({
                  title,
                  coverImage: coverPath,
                  seasons: [],
                });
              }
    
              // Find or create season
              const seasonNum = parseInt(seasonNumber);
              let season = series.seasons.find((s) => s.seasonNumber === seasonNum);
              if (!season) {
                season = {
                  seasonNumber: seasonNum,
                  episodes: [],
                };
                series.seasons.push(season);
              }
    
              // Add new episode
              const episodeNum = parseInt(episodeNumber);
              const existingEpisodeIndex = season.episodes.findIndex((ep) =>
                ep.filePath.includes(`s${seasonNum}e${episodeNum}`)
              );
    
              if (existingEpisodeIndex >= 0) {
                // Update existing episode
                season.episodes[existingEpisodeIndex] = {
                  title: episodeTitle,
                  filePath: finalFilename,
                };
              } else {
                // Add new episode
                season.episodes.push({
                  title: episodeTitle,
                  filePath: finalFilename,
                });
              }
    
              // Sort episodes by episode number
              season.episodes.sort((a, b) => {
                const numA = parseInt(a.filePath.match(/e(\d+)/i)[1]);
                const numB = parseInt(b.filePath.match(/e(\d+)/i)[1]);
                return numA - numB;
              });
    
              await series.save();
              console.log('Series saved to database:', series._id);

              // Clean up only after successful database save
              deleteFolderRecursive(upload.tempDir);
              activeUploads.delete(fileId);

              return res.json({ 
                success: true, 
                seriesId: series._id,
                message: 'Series upload complete'
              });
            } catch (error) {
              console.log("Series upload error:", error.message);
              return res.status(500).json({
                success: false,
                error: "Failed to save series data"+error.message,
              });
            }
          }
        } catch (error) {
          console.error('Error during finalization:', error);
          if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
          }
          deleteFolderRecursive(upload.tempDir);
          activeUploads.delete(fileId);
          throw error;
        }
      }

      // If not final chunk, return success
      return res.json({ 
        success: true,
        message: `Chunk ${currentIndex + 1} of ${total} received`
      });

    } catch (error) {
      console.error('Chunk processing error:', error);
      return res.status(500).json({
        success: false,
        error: "Failed to process chunk: " + error.message
      });
    }
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message || "Unknown error occurred" 
    });
  }
});

async function combineChunks(chunks, tempDir, finalPath, total) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(finalPath, {
      flags: 'w',
      encoding: 'binary',
      highWaterMark: 1024 * 1024 // 1MB buffer
    });

    let currentChunk = 0;

    function processNextChunk() {
      if (currentChunk >= total) {
        writeStream.end();
        return;
      }

      const chunkPath = path.join(tempDir, `chunk-${currentChunk}`);
      const readStream = fs.createReadStream(chunkPath, {
        highWaterMark: 1024 * 1024 // 1MB buffer
      });

      readStream.on('error', (error) => {
        writeStream.end();
        reject(error);
      });

      readStream.on('end', () => {
        currentChunk++;
        processNextChunk();
      });

      readStream.pipe(writeStream, { end: false });
    }

    writeStream.on('error', reject);
    writeStream.on('finish', resolve);

    processNextChunk();
  });
}

// Add this new route for checking upload status
router.get("/upload-status/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const upload = activeUploads.get(fileId);
  
  if (!upload) {
    return res.json({ 
      success: true, 
      completed: true,
      message: 'Upload completed and processed'
    });
  }

  return res.json({
    success: true,
    completed: false,
    message: 'Upload still processing'
  });
});

router.get("/stream/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const range = req.headers.range;
    let filePath;
    if (type === "movie") {
      const movie = await Movie.findById(id);
      if (!movie) {
        return res.status(404).json({ error: "Movie not found" });
      }
      filePath = path.join(UPLOAD_PATH, movie.filePath);
    } else if (type === "episode") {
      const series = await Series.findOne({ "seasons.episodes._id": id });
      if (!series) {
        return res.status(404).json({ error: "Episode not found" });
      }
      const episode = series.seasons
        .flatMap((s) => s.episodes)
        .find((e) => e._id.toString() === id);
      filePath = path.join(UPLOAD_PATH, episode.filePath);
    } else {
      return res.status(400).json({ error: "Invalid content type" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileType = filePath.split(".").pop().toLowerCase();
    const contentType = mimeTypes[fileType] || "video/mp4";
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error("Streaming error:", error);
    res.status(500).json({ error: "Error streaming content" });
  }
});

router.get("/all-movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

router.get("/all-series", async (req, res) => {
  const series = await Series.find();
  res.json(series);
});

router.get("/all-series/:name", async (req, res) => {
  const series = await Series.findOne({ title: req.params.name });
  res.json(series);
});

router.get("/all-series/:name/:season", async (req, res) => {
  const series = await Series.findOne({ title: req.params.name });
  const season = series.seasons.find(
    (s) => s.seasonNumber === parseInt(req.params.season)
  );
  res.json(season);
});

router.get("/episode-info/:id", async (req, res) => {
  try {
    const series = await Series.findOne({
      "seasons.episodes._id": req.params.id,
    });
    if (!series) {
      return res.status(404).json({ error: "Episode not found" });
    }
    const episode = series.seasons
      .find((e) => e.episodes.find((ep) => ep._id.toString() === req.params.id))
      .episodes.find((ep) => ep._id.toString() === req.params.id);
    res.json({
      seriesTitle: series.title,
      episodeTitle: episode.title,
    });
  } catch (error) {
    console.error("Error fetching episode info:", error);
    res.status(500).json({ error: "Error fetching episode info" });
  }
});

router.get("/movie-info/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }
    res.json({ title: movie.title });
  } catch (error) {
    console.error("Error fetching movie info:", error);
    res.status(500).json({ error: "Error fetching movie info" });
  }
});

module.exports = router;
