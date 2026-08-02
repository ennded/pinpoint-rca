const Incident = require("../models/Incident");

// Estimates how long this kind of failure typically takes to fix, based on
// resolved past incidents of the same error type (optionally narrowed to the
// same service, which is a stronger signal when there's enough history).
async function estimateTimeToFix({ errorType, service }) {
  const base = { errorType, resolved: true, resolutionTimeMinutes: { $ne: null } };

  const sameServiceMatches = await Incident.find({ ...base, service }).select("resolutionTimeMinutes").lean();
  const pool = sameServiceMatches.length >= 2
    ? sameServiceMatches
    : await Incident.find(base).select("resolutionTimeMinutes").lean();

  if (pool.length === 0) return null;

  const avg = pool.reduce((sum, i) => sum + i.resolutionTimeMinutes, 0) / pool.length;
  return {
    averageMinutes: Math.round(avg),
    sampleSize: pool.length,
    scope: sameServiceMatches.length >= 2 ? "service" : "error-type",
  };
}

module.exports = { estimateTimeToFix };
