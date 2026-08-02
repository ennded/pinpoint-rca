const express = require("express");
const { generateDigest, formatDigestText } = require("../services/digest");
const { runDigest } = require("../services/digestScheduler");

const router = express.Router();

// Preview the digest without sending anything.
router.get("/preview", async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const digest = await generateDigest({ days });
    res.json({ digest, text: formatDigestText(digest) });
  } catch (err) {
    next(err);
  }
});

// Manually fire the same digest the weekly cron job runs — useful for
// demoing/testing without waiting for Monday 9am.
router.post("/run-now", async (req, res, next) => {
  try {
    const digest = await runDigest();
    res.json({ ok: true, digest });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
