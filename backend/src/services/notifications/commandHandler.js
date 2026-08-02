// Platform-agnostic core: interprets a free-text reply as a command and
// applies it to Mongo. Both the Slack and Teams adapters funnel their
// normalized payloads through this same handler, so the actual "resolved" /
// "not helpful" business logic exists exactly once.
const Incident = require("../../models/Incident");

function parseCommand(text) {
  if (!text) return null;
  const lower = text.trim().toLowerCase();
  if (/\bnot[\s-]?helpful\b|\bwrong\b|\bincorrect\b/.test(lower)) return "not-helpful";
  if (/\bresolved\b|\bfixed\b|\bdone\b/.test(lower)) return "resolved";
  if (/\bhelpful\b/.test(lower)) return "helpful";
  return null;
}

async function applyCommand({ incidentId, command }) {
  const incident = await Incident.findById(incidentId);
  if (!incident) return { ok: false, error: "Incident not found" };

  if (command === "resolved") {
    incident.resolved = true;
    incident.resolvedAt = new Date();
    incident.resolutionTimeMinutes = Math.round((incident.resolvedAt - incident.createdAt) / 60000);
    await incident.save();
    return { ok: true, action: "resolved", incidentId: incident._id };
  }

  if (command === "helpful" || command === "not-helpful") {
    const targetId = incident.matchedIncident || incident._id;
    const field = command === "helpful" ? "feedback.helpful" : "feedback.notHelpful";
    await Incident.findByIdAndUpdate(targetId, { $inc: { [field]: 1 } });
    return { ok: true, action: command, votedOn: targetId };
  }

  return { ok: false, error: `Unrecognized command: ${command}` };
}

// Given a normalized inbound payload ({ text, threadRef }), finds the
// incident that thread belongs to and applies whatever command the text
// contains. Shared by every platform adapter's webhook route.
async function handleInboundReply({ platform, text, threadRef }) {
  if (!threadRef) return { ok: false, error: "Missing thread reference" };

  const incident = await Incident.findOne({ [`notifications.${platform}.ref`]: threadRef });
  if (!incident) return { ok: false, error: "No incident found for this thread" };

  const command = parseCommand(text);
  if (!command) return { ok: true, action: "ignored", reason: "No recognized command in message" };

  return applyCommand({ incidentId: incident._id, command });
}

module.exports = { parseCommand, applyCommand, handleInboundReply };
