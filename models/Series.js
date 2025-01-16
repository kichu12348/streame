const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
  title: String,
  filePath: String,
  thumbnail: String
});

const seasonSchema = new mongoose.Schema({
  seasonNumber: Number,
  episodes: [episodeSchema],
});

const seriesSchema = new mongoose.Schema({
  title: String,
  coverImage: String,
  seasons: [seasonSchema],
});

module.exports = mongoose.model('Series', seriesSchema);