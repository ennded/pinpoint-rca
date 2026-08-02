const express = require("express");
const Incident = require("../models/Incident");
const slackAdapter = require("../services/notifications/slackAdapter");
const teamsAdapter = require("../services/notifications/teamsAdapter");
const { handleInboundReply } = require("../services/notifications/commandHandler");

const router = express.Router();
const ADAPTERS = { slack: slackAdapter, teams: teamsAdapter };

// Outbound: post an incident to Slack or Teams, storing a thread reference
// so a later reply can be matched back to it.
router.post("/:platform/post/:incidentId", async (req, res, next) => {
  try {
    const adapter = ADAPTERS[req.params.platform];
    if (!adapter) return res.status(400).json({ error: `Unknown platform: ${req.params.platform}` });

    const incident = await Incident.findById(req.params.incidentId).select("-embedding");
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const text = adapter.formatOutboundMessage(incident);
    const existingRef = incident.notifications?.[adapter.platform]?.ref || null;
    const result = await adapter.sendMessage({
      channel: req.body?.channel,
      conversationId: req.body?.conversationId,
      text,
      threadRef: existingRef,
    });
    // Real adapters return their own thread ref (e.g. Slack's message `ts`);
    // stubbed adapters have none, so fall back to a locally generated one.
    const threadRef = result.threadRef || existingRef || adapter.buildThreadRef();

    incident.notifications = incident.notifications || {};
    incident.notifications[adapter.platform] = { ref: threadRef };
    await incident.save();

    res.json({
      ok: true,
      stub: Boolean(result.stub),
      platform: adapter.platform,
      threadRef,
      message: result.stub
        ? `Posted to ${adapter.platform} (stub) — logged instead of sent.`
        : `Posted to ${adapter.platform}.`,
    });
  } catch (err) {
    next(err);
  }
});

// Inbound: webhook target for each platform's events API / bot endpoint.
// Both routes normalize their payload the same way and hand off to the
// shared command handler — this is the "two-way" half of the bot.
router.post("/:platform/events", async (req, res, next) => {
  try {
    const adapter = ADAPTERS[req.params.platform];
    if (!adapter) return res.status(400).json({ error: `Unknown platform: ${req.params.platform}` });
    if (!adapter.verifySignature(req)) return res.status(401).json({ error: "Invalid signature" });

    // Slack's URL verification handshake — echo the challenge back.
    if (req.body?.type === "url_verification") {
      return res.json({ challenge: req.body.challenge });
    }

    const { text, threadRef } = adapter.parseInboundPayload(req.body);
    const result = await handleInboundReply({ platform: adapter.platform, text, threadRef });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
