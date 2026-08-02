const Incident = require("../models/Incident");

async function generateDigest({ days = 7 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const incidents = await Incident.find({ createdAt: { $gte: since } }).select("-embedding").lean();

  const byService = {};
  const byErrorType = {};
  const byCategory = {};
  let resolvedCount = 0;
  let resolutionMinutesSum = 0;
  let resolutionMinutesCount = 0;

  for (const incident of incidents) {
    byService[incident.service] = (byService[incident.service] || 0) + 1;
    byErrorType[incident.errorType] = (byErrorType[incident.errorType] || 0) + 1;
    if (incident.category) byCategory[incident.category] = (byCategory[incident.category] || 0) + 1;
    if (incident.resolved) resolvedCount++;
    if (incident.resolutionTimeMinutes != null) {
      resolutionMinutesSum += incident.resolutionTimeMinutes;
      resolutionMinutesCount++;
    }
  }

  // "Recurring pattern" = the same error type showing up 3+ times this week —
  // a candidate for an actual fix rather than repeated firefighting.
  const recurringPatterns = Object.entries(byErrorType)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([errorType, count]) => ({ errorType, count }));

  const topServices = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([service, count]) => ({ service, count }));

  return {
    periodStart: since,
    periodEnd: new Date(),
    totalFailures: incidents.length,
    resolvedCount,
    resolutionRate: incidents.length ? resolvedCount / incidents.length : 0,
    averageResolutionMinutes: resolutionMinutesCount ? Math.round(resolutionMinutesSum / resolutionMinutesCount) : null,
    byService,
    byErrorType,
    byCategory,
    recurringPatterns,
    topServices,
  };
}

function formatDigestText(digest) {
  const lines = [
    `RootCause AI — Weekly Digest`,
    `${digest.periodStart.toDateString()} → ${digest.periodEnd.toDateString()}`,
    ``,
    `Total failures: ${digest.totalFailures}`,
    `Resolved: ${digest.resolvedCount} (${Math.round(digest.resolutionRate * 100)}%)`,
    digest.averageResolutionMinutes != null ? `Average time to fix: ~${digest.averageResolutionMinutes} min` : `Average time to fix: n/a`,
    ``,
    `Top services by failure count:`,
    ...digest.topServices.map((s) => `  - ${s.service}: ${s.count}`),
  ];

  if (digest.recurringPatterns.length) {
    lines.push(``, `Recurring patterns (3+ occurrences — worth a real fix):`);
    lines.push(...digest.recurringPatterns.map((p) => `  - ${p.errorType}: ${p.count} times`));
  }

  return lines.join("\n");
}

module.exports = { generateDigest, formatDigestText };
