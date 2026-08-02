const express = require("express");
const Build = require("../models/Build");
const Incident = require("../models/Incident");
const { parseLog } = require("../services/logParser");
const { getEmbedding } = require("../services/embeddings");
const { findSimilarIncident } = require("../services/similarity");
const { explainError } = require("../services/llm");
const { estimateTimeToFix } = require("../services/stats");

const router = express.Router();

// List recent builds for the sidebar, newest first. Optionally filtered by
// root-cause category (?category=dependency) for the frontend's category filter.
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    const builds = await Build.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json(builds);
  } catch (err) {
    next(err);
  }
});

// Full detail for one build, including its incident (log/explanation/fix),
// the matched past incident (if any), and a time-to-fix estimate.
router.get("/:id", async (req, res, next) => {
  try {
    const build = await Build.findById(req.params.id).lean();
    if (!build) return res.status(404).json({ error: "Build not found" });

    let incident = null;
    let matchedIncident = null;
    let timeToFix = null;
    if (build.incident) {
      incident = await Incident.findById(build.incident).lean();
      if (incident?.matchedIncident) {
        matchedIncident = await Incident.findById(incident.matchedIncident)
          .select("-embedding")
          .lean();
        if (matchedIncident) matchedIncident.score = incident.matchScore;
      }
      if (incident) {
        timeToFix = await estimateTimeToFix({ errorType: incident.errorType, service: incident.service });
      }
    }

    res.json({ build, incident, matchedIncident, timeToFix });
  } catch (err) {
    next(err);
  }
});

// Runs a pasted-in error log (e.g. copied from a real production incident)
// through the RCA pipeline: parse -> embed -> similarity search -> LLM
// explanation. This is an ad-hoc lookup, not a CI/CD run — it persists the
// incident (so future matches can find it, and so its fix can be marked
// resolved / posted to Slack) but deliberately does NOT create a Build,
// since no pipeline actually ran. It won't appear in the "Recent Builds"
// sidebar.
router.post("/analyze", async (req, res, next) => {
  try {
    const { rawLog, service } = req.body || {};
    if (typeof rawLog !== "string" || !rawLog.trim()) {
      return res.status(400).json({ error: "Body must include non-empty string 'rawLog'" });
    }

    const buildId = `pasted-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const parsed = parseLog(rawLog);
    const resolvedService = service || parsed.service;

    const embedding = await getEmbedding(`${parsed.errorType}: ${parsed.keyLine}`);
    const match = await findSimilarIncident(embedding);

    const { explanation, fix, severity, category } = await explainError({
      errorType: parsed.errorType,
      service: resolvedService,
      keyLine: parsed.keyLine,
      rawLog,
      matchedIncident: match,
    });

    const incident = await Incident.create({
      buildId,
      service: resolvedService,
      rawLog,
      errorType: parsed.errorType,
      keyLine: parsed.keyLine,
      embedding,
      explanation,
      fix,
      severity,
      category,
      matchedIncident: match ? match.incident._id : null,
      matchScore: match ? match.score : null,
    });

    const matchedIncident = match
      ? await Incident.findById(match.incident._id).select("-embedding").lean()
      : null;

    const incidentObj = incident.toObject();
    delete incidentObj.embedding;

    res.status(201).json({
      incident: incidentObj,
      matchedIncident: matchedIncident ? { ...matchedIncident, score: match.score } : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
