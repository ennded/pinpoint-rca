const cron = require("node-cron");
const { generateDigest, formatDigestText } = require("./digest");
const { sendEmail } = require("./email");
const slackAdapter = require("./notifications/slackAdapter");

async function runDigest() {
  const digest = await generateDigest({ days: 7 });
  const text = formatDigestText(digest);

  await sendEmail({
    to: process.env.DIGEST_EMAIL_TO || "team-lead@example.com",
    subject: "RootCause AI — Weekly Digest",
    body: text,
  });
  await slackAdapter.sendMessage({ channel: process.env.DIGEST_SLACK_CHANNEL || "eng-leads", text });

  return digest;
}

// Every Monday at 9am server time.
function scheduleWeeklyDigest() {
  cron.schedule("0 9 * * 1", () => {
    runDigest().catch((err) => console.error("[digest] weekly run failed:", err.message));
  });
  console.log("[digest] weekly digest scheduled for Mondays at 09:00");
}

module.exports = { runDigest, scheduleWeeklyDigest };
