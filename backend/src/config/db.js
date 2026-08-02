const mongoose = require("mongoose");

// When MONGODB_URI isn't set, spin up an in-memory MongoDB for local dev so
// the app runs with zero setup. Set MONGODB_URI (local install or Atlas) to
// use a real, persistent database instead.
async function resolveConnectionUri() {
  if (process.env.MONGODB_URI) {
    return { uri: process.env.MONGODB_URI, mock: false };
  }

  console.warn("[mongo] MONGODB_URI not set — starting an in-memory MongoDB for this session (data will not persist).");
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  return { uri: mem.getUri(), mock: true };
}

async function connectDB() {
  const { uri, mock } = await resolveConnectionUri();

  mongoose.connection.on("connected", () => {
    console.log(`[mongo] connected${mock ? " (in-memory mock)" : ""}`);
  });
  mongoose.connection.on("error", (err) => {
    console.error("[mongo] connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[mongo] disconnected");
  });

  await mongoose.connect(uri);
  return mongoose.connection;
}

module.exports = { connectDB };
