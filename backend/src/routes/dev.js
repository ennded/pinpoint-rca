// Dev-only helper to backfill a plausible history so the trend chart and
// feedback-driven ranking have something to show without waiting days.
const express = require("express");
const Incident = require("../models/Incident");
const Build = require("../models/Build");
const { parseLog } = require("../services/logParser");
const { getEmbedding } = require("../services/embeddings");
const { explainError } = require("../services/llm");
const { listSampleLogs } = require("../services/github");
const { cosineSimilarity } = require("../services/similarity");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const SAMPLES_DIR = path.join(__dirname, "..", "..", "samples");

router.post("/seed-demo-data", async (req, res, next) => {
  try {
    const count = Math.min(60, Math.max(1, parseInt(req.body?.count, 10) || 25));
    const sampleFiles = listSampleLogs();
    const created = [];

    for (let i = 0; i < count; i++) {
      const file = sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
      const rawLog = fs.readFileSync(path.join(SAMPLES_DIR, file), "utf8");
      const parsed = parseLog(rawLog);
      const embedding = await getEmbedding(`${parsed.errorType}: ${parsed.keyLine}`);
      const { explanation, fix, severity, category } = await explainError({
        errorType: parsed.errorType,
        service: parsed.service,
        keyLine: parsed.keyLine,
        rawLog,
        matchedIncident: null,
      });

      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const buildId = `build-seed-${Date.now()}-${i}`;
      const resolved = Math.random() < 0.6;

      const incident = await Incident.create({
        buildId,
        service: parsed.service,
        rawLog,
        errorType: parsed.errorType,
        keyLine: parsed.keyLine,
        embedding,
        explanation,
        fix,
        severity,
        category,
        createdAt,
        updatedAt: createdAt,
        resolved,
        resolvedAt: resolved ? new Date(createdAt.getTime() + Math.random() * 60 * 60000) : null,
        resolutionTimeMinutes: resolved ? Math.round(Math.random() * 60) : null,
      });
      // createdAt is normally managed by timestamps: true; override directly for seed realism.
      await Incident.collection.updateOne({ _id: incident._id }, { $set: { createdAt } });

      const build = await Build.create({ buildId, service: parsed.service, status: "failed", incident: incident._id, severity, category });
      await Build.collection.updateOne({ _id: build._id }, { $set: { createdAt, updatedAt: createdAt } });
      created.push(incident._id);
    }

    res.status(201).json({ ok: true, created: created.length });
  } catch (err) {
    next(err);
  }
});

router.post("/rank-debug", async (req, res, next) => {
  try {
    const { text } = req.body || {};
    const embedding = await getEmbedding(text);
    const candidates = await Incident.find({}).select("+embedding").lean();
    const ranked = candidates
      .map((c) => {
        const rawScore = cosineSimilarity(embedding, c.embedding);
        const helpful = c.feedback?.helpful || 0;
        const notHelpful = c.feedback?.notHelpful || 0;
        const netNegative = notHelpful - helpful;
        const penalty = notHelpful < 2 || netNegative <= 0 ? 0 : Math.min(0.3, netNegative * 0.05);
        return {
          id: c._id,
          service: c.service,
          errorType: c.errorType,
          feedback: c.feedback,
          rawScore,
          penalty,
          score: Math.max(0, rawScore - penalty),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    res.json(ranked);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
