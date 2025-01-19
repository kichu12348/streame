require("mongoose")
  .connect("mongodb://127.0.0.1:27017/streamingDB")
  .then(() => {
    console.log("Connected to MongoDB 😼");
  })
  .catch((err) => {
    console.log("demn you messed up: ", err.message);
  });
