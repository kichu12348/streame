const express = require("express");
const fs = require("fs");
const path = require("path");
const fileUpload = require('express-fileupload');
const {connectToDb} = require('./db');
const contentRoutes = require('./routes/contentRoutes');


connectToDb();


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

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'temp'),
  abortOnLimit: true,
  // Automatically removes temporary files after request ends
  cleanup: true
}));

// Ensure upload and temp directories exist
const uploadDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
[uploadDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Routes
app.use('/api', contentRoutes);


// redirect unknown routes to browse page


app.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "upload.html"));
});

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "player.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "browse.html"));
});

app.get("/browse", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "browse.html"));
});

app.get("/series", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "series.html"));
});

// Backward compatibility for existing video route
app.get("/video/:filename", (req, res) => {
  const filename = req.params.filename;
  const fileType = filename.split(".").pop().toLowerCase();
  const videoPath = path.join(__dirname, 'uploads', filename);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = mimeTypes[fileType] || `video/${fileType}`;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const contentLength = end - start + 1;
    
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": contentType,
    });
    
    fs.createReadStream(videoPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});


// redirect unknown routes to browse page
app.get("*", (req, res) => {
  res.redirect("/browse");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.log(err.stack);
  res.status(500).send('Something broke!');
});




app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});