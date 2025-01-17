const mongoose = require("mongoose");

async function connectToDb() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/streamingDB");
    console.log("Connected to MongoDB 😼");
  } catch (error) {
    console.log("Error connecting to MongoDB 😬 :", error.message);
  }
}

module.exports = connectToDb;
