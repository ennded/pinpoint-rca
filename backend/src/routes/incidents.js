const express = require("express");
const Incident = require("../models/Incident");

const router = express.Router();

router.patch("/:id/resolve", async (req, res, next) => {
  try {
    const existing = await Incident.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Incident not found" });

    const resolvedAt = new Date();
    const resolutionTimeMinutes = Math.round((resolvedAt - existing.createdAt) / 60000);

    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt, resolutionTimeMinutes },
      { new: true }
    ).select("-embedding");
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

// Feedback is about whether the explanation shown (which was built using the
// matched past incident, if any) was actually useful. If this incident
// matched a past one, the vote counts against that past incident's record
// so future similarity search can deprioritize it — that's the incident
// whose retrieval quality is actually in question. Otherwise it counts
// against this incident itself.
router.post("/:id/feedback", async (req, res, next) => {
  try {
    const { helpful } = req.body || {};
    if (typeof helpful !== "boolean") {
      return res.status(400).json({ error: "Body must include boolean 'helpful'" });
    }

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const targetId = incident.matchedIncident || incident._id;
    const field = helpful ? "feedback.helpful" : "feedback.notHelpful";
    const updated = await Incident.findByIdAndUpdate(
      targetId,
      { $inc: { [field]: 1 } },
      { new: true }
    ).select("-embedding");

    res.json({ ok: true, votedOn: targetId, feedback: updated.feedback });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
