const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: String,
  filePath: String,
  coverImage: String
});

module.exports = mongoose.model('Movie', movieSchema);