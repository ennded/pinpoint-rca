// Normalizes Microsoft Teams' Bot Framework Activity shapes into the same
// { text, threadRef, userId } format the Slack adapter produces, so both
// funnel through the same commandHandler. Real Teams auth/posting is
// stubbed — swap sendMessage for a Bot Framework `sendActivity` call, and
// verifySignature for JWT validation against the bot's app credentials.
const crypto = require("crypto");

function verifySignature(req) {
  return true; // TODO: validate the Bearer JWT against Teams' OpenID config
}

function buildThreadRef() {
  return `teams-${crypto.randomBytes(6).toString("hex")}`;
}

function formatOutboundMessage(incident) {
  return [
    `[${(incident.severity || "unknown").toUpperCase()}] ${incident.errorType} in ${incident.service}`,
    incident.explanation,
    `Suggested fix: ${incident.fix}`,
    `Reply "resolved", "helpful", or "not helpful" in this conversation.`,
  ].join("\n");
}

async function sendMessage({ conversationId, text }) {
  console.log(`[teams:stub] -> conversation ${conversationId || "incidents"}: ${text}`);
  return { ok: true, stub: true };
}

// Bot Framework Activity shape (simplified):
// { type: "message", text, conversation: { id }, from: { id } }
function parseInboundPayload(body) {
  return {
    text: body?.text || "",
    threadRef: body?.conversation?.id || null,
    userId: body?.from?.id || null,
  };
}

module.exports = { platform: "teams", verifySignature, buildThreadRef, formatOutboundMessage, sendMessage, parseInboundPayload };
