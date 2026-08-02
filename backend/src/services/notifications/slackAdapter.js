// Normalizes Slack's webhook shapes into the platform-agnostic format the
// shared command handler expects. Posts via the real chat.postMessage API
// when SLACK_BOT_TOKEN is set; otherwise falls back to logging so the app
// keeps working without credentials configured.
const crypto = require("crypto");

// Slack signs every request (including the URL verification handshake) with
// HMAC-SHA256 over "v0:{timestamp}:{rawBody}", keyed by the signing secret.
// Requires index.js to have captured req.rawBody from the raw request bytes,
// since a JSON.stringify of the parsed body won't byte-match what Slack sent.
function verifySignature(req) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;

  const timestamp = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];
  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes to guard against replay attacks.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;

  const base = `v0:${timestamp}:${req.rawBody || ""}`;
  const expected = `v0=${crypto.createHmac("sha256", secret).update(base).digest("hex")}`;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function buildThreadRef() {
  return `slack-${crypto.randomBytes(6).toString("hex")}`;
}

function formatOutboundMessage(incident) {
  return [
    `*[${(incident.severity || "unknown").toUpperCase()}] ${incident.errorType}* in *${incident.service}*`,
    incident.explanation,
    `*Suggested fix:* ${incident.fix}`,
    `_Reply "resolved", "helpful", or "not helpful" in this thread._`,
  ].join("\n");
}

async function sendMessage({ channel, text, threadRef }) {
  const token = process.env.SLACK_BOT_TOKEN;
  const target = channel || process.env.SLACK_DEFAULT_CHANNEL || "incidents";

  if (!token) {
    console.log(`[slack:stub] SLACK_BOT_TOKEN not set -> #${target}: ${text}`);
    return { ok: true, stub: true };
  }

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: target, text, thread_ts: threadRef || undefined }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);

  // Slack's own message timestamp doubles as the thread ref for later replies.
  return { ok: true, threadRef: data.ts };
}

// Slack Events API "message" event shape (simplified):
// { event: { type: "message", text, thread_ts, user, channel } }
function parseInboundPayload(body) {
  const event = body?.event || {};
  return {
    text: event.text || "",
    threadRef: event.thread_ts || null,
    userId: event.user || null,
  };
}

module.exports = { platform: "slack", verifySignature, buildThreadRef, formatOutboundMessage, sendMessage, parseInboundPayload };
