require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const buildsRouter = require("./routes/builds");
const incidentsRouter = require("./routes/incidents");
const analyticsRouter = require("./routes/analytics");
const notificationsRouter = require("./routes/notifications");
const digestRouter = require("./routes/digest");
const devRouter = require("./routes/dev");
const { scheduleWeeklyDigest } = require("./services/digestScheduler");

const app = express();
app.use(cors());
// Slack's request signature is an HMAC over the exact raw bytes it sent, so
// the parsed-then-restringified body won't byte-match — stash the raw body
// here for slackAdapter.verifySignature to use.
app.use(
  express.json({
    limit: "5mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "rootcause-ai-backend",
    mockOpenAI: !process.env.OPENAI_API_KEY,
    mockMongo: !process.env.MONGODB_URI,
    mockGithub: !process.env.GITHUB_TOKEN,
    mockSlack: !process.env.SLACK_BOT_TOKEN,
  });
});

app.use("/api/builds", buildsRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/digest", digestRouter);
app.use("/api/dev", devRouter);

app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] RootCause AI backend listening on port ${PORT}`);
  });
  scheduleWeeklyDigest();
}

start().catch((err) => {
  console.error("[server] failed to start:", err.message);
  process.exit(1);
});
