const Incident = require("../models/Incident");

const DEFAULT_THRESHOLD = 0.82;

// Past incidents that users have repeatedly flagged as "not helpful" get
// pushed down in ranking. A single stray downvote shouldn't matter — this
// only kicks in once notHelpful votes clearly outweigh helpful ones.
function feedbackPenalty(feedback) {
  const helpful = feedback?.helpful || 0;
  const notHelpful = feedback?.notHelpful || 0;
  if (notHelpful < 2) return 0;
  const netNegative = notHelpful - helpful;
  if (netNegative <= 0) return 0;
  return Math.min(0.3, netNegative * 0.05);
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("cosineSimilarity: vectors must be the same length");
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Finds the most similar past incident to a given embedding, above a
 * minimum similarity threshold. Comparison happens in application code
 * since we don't have a vector index set up on the Mongo collection.
 *
 * @param {number[]} embedding
 * @param {{ threshold?: number }} [options]
 * @returns {Promise<{ incident: import("mongoose").Document, score: number } | null>}
 */
async function findSimilarIncident(embedding, { threshold = DEFAULT_THRESHOLD } = {}) {
  const candidates = await Incident.find({}).select("+embedding").lean();

  let best = null;
  for (const candidate of candidates) {
    if (!candidate.embedding || candidate.embedding.length !== embedding.length) continue;
    const rawScore = cosineSimilarity(embedding, candidate.embedding);
    const score = Math.max(0, rawScore - feedbackPenalty(candidate.feedback));
    if (!best || score > best.score) {
      best = { incident: candidate, score, rawScore };
    }
  }

  if (!best || best.score < threshold) return null;
  return best;
}

module.exports = { cosineSimilarity, findSimilarIncident, DEFAULT_THRESHOLD };
