const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const Series = require('../models/Series');
const fs = require('fs');
const path = require('path');

const UPLOAD_PATH = path.join(__dirname, '../uploads');
const TEMP_PATH = path.join(__dirname, '../temp');
const COVERS_PATH = path.join(__dirname, '../public/covers');

const mimeTypes = {
  'mkv': 'video/x-matroska',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'ogg': 'video/ogg',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  '3gp': 'video/3gpp',
  'ts': 'video/mp2t'
};

// Ensure upload directory exists
[UPLOAD_PATH, TEMP_PATH, COVERS_PATH].forEach(dir => {
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
      }
    };


// Store active uploads
const activeUploads = new Map();

router.post('/upload-cover', async (req, res) => {
    try {
        if (!req.files || !req.files.cover) {
            return res.status(400).json({ success: false, error: 'No cover image provided' });
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

router.post('/upload-chunk', async (req, res) => {
    try {
        const { chunkIndex, totalChunks, fileId, type, title, seasonNumber, episodeNumber, episodeTitle, coverPath } = req.body;
        const chunk = req.files.file;
        
        if (!chunk) {
            return res.status(400).json({ success: false, error: 'No chunk provided' });
        }

        const currentIndex = parseInt(chunkIndex);
        const total = parseInt(totalChunks);

        // Create or get upload session
        if (!activeUploads.has(fileId)) {
            const tempDir = path.join(TEMP_PATH, fileId);
            fs.mkdirSync(tempDir, { recursive: true });
            activeUploads.set(fileId, {
                chunks: new Set(),
                tempDir,
                type,
                title,
                seasonNumber,
                episodeNumber,
                episodeTitle
            });
        }

        const upload = activeUploads.get(fileId);
        const chunkPath = path.join(upload.tempDir, `chunk-${currentIndex}`);
        
        // Save chunk
        await chunk.mv(chunkPath);
        upload.chunks.add(currentIndex);

        // Check if upload is complete
        if (upload.chunks.size === total) {
            const ext = path.extname(chunk.name) || '.mp4';
            const finalFilename = type === 'movie' 
                ? `movie_${Date.now()}${ext}`
                : `series_${Date.now()}_s${seasonNumber}e${episodeNumber}${ext}`;
            const finalPath = path.join(UPLOAD_PATH, finalFilename);

            // Combine chunks
            const writeStream = fs.createWriteStream(finalPath);
            for (let i = 0; i < total; i++) {
                const chunkData = fs.readFileSync(path.join(upload.tempDir, `chunk-${i}`));
                writeStream.write(chunkData);
            }
            writeStream.end();

            // Wait for write to complete
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            // Clean up temp directory
            fs.rmSync(upload.tempDir, { recursive: true, force: true });
            activeUploads.delete(fileId);

            // Save to database
            if (type === 'movie') {
                const newMovie = new Movie({ 
                    title, 
                    filePath: finalFilename,
                    coverImage: coverPath 
                });
                await newMovie.save();
                return res.json({ success: true, movieId: newMovie._id });
            } else {
                // Series upload
                try {
                    let series = await Series.findOne({ title });
                    if (!series) {
                        series = new Series({ 
                            title, 
                            coverImage: coverPath,
                            seasons: []
                        });
                    }

                    // Find or create season
                    const seasonNum = parseInt(seasonNumber);
                    let season = series.seasons.find(s => s.seasonNumber === seasonNum);
                    if (!season) {
                        season = { 
                            seasonNumber: seasonNum, 
                            episodes: []
                        };
                        series.seasons.push(season);
                    }

                    // Add new episode
                    const episodeNum = parseInt(episodeNumber);
                    const existingEpisodeIndex = season.episodes.findIndex(
                        ep => ep.filePath.includes(`s${seasonNum}e${episodeNum}`)
                    );

                    if (existingEpisodeIndex >= 0) {
                        // Update existing episode
                        season.episodes[existingEpisodeIndex] = {
                            title: episodeTitle,
                            filePath: finalFilename
                        };
                    } else {
                        // Add new episode
                        season.episodes.push({
                            title: episodeTitle,
                            filePath: finalFilename
                        });
                    }

                    // Sort episodes by episode number
                    season.episodes.sort((a, b) => {
                        const numA = parseInt(a.filePath.match(/e(\d+)/i)[1]);
                        const numB = parseInt(b.filePath.match(/e(\d+)/i)[1]);
                        return numA - numB;
                    });

                    await series.save();
                    return res.json({ success: true, seriesId: series._id });
                } catch (error) {
                    console.error('Series upload error:', error);
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Failed to save series data' 
                    });
                }
            }
        }

        return res.json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/stream/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const range = req.headers.range;
        
        let filePath;
        if (type === 'movie') {
            const movie = await Movie.findById(id);
            if (!movie) {
                return res.status(404).json({ error: 'Movie not found' });
            }
            filePath = path.join(UPLOAD_PATH, movie.filePath);
        } else if (type === 'episode') {
            const series = await Series.findOne({ 'seasons.episodes._id': id });
            if (!series) {
                return res.status(404).json({ error: 'Episode not found' });
            }
            const episode = series.seasons
                .flatMap(s => s.episodes)
                .find(e => e._id.toString() === id);
            filePath = path.join(UPLOAD_PATH, episode.filePath);
        } else {
            return res.status(400).json({ error: 'Invalid content type' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const fileType = filePath.split('.').pop().toLowerCase();
        const contentType = mimeTypes[fileType] || 'video/mp4';
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
            const chunksize = (end-start)+1;
            const file = fs.createReadStream(filePath, {start, end});
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            });
            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        console.error('Streaming error:', error);
        res.status(500).json({ error: 'Error streaming content' });
    }
});

router.get('/all-movies', async (req, res) => {
    const movies = await Movie.find();
    res.json(movies);
});

router.get('/all-series', async (req, res) => {
    const series = await Series.find();
    res.json(series);
});


router.get('/all-series/:name', async (req, res) => {
    const series = await Series.findOne({ title: req.params.name });
    res.json(series);
});

router.get('/all-series/:name/:season', async (req, res) => {
    const series = await Series.findOne({ title: req.params.name });
    const season = series.seasons.find(s => s.seasonNumber === parseInt(req.params.season));
    res.json(season);
});

router.get('/episode-info/:id', async (req, res) => {
    try {
        const series = await Series.findOne({ 'seasons.episodes._id': req.params.id });
        if (!series) {
            return res.status(404).json({ error: 'Episode not found' });
        }
        res.json({ seriesTitle: series.title });
    } catch (error) {
        console.error('Error fetching episode info:', error);
        res.status(500).json({ error: 'Error fetching episode info' });
    }
});

module.exports = router;