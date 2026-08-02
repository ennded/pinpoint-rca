// Standalone smoke test for embeddings + cosine similarity in mock mode
// (no OPENAI_API_KEY needed). Run with: node backend/scripts/test-embeddings.js
const { getEmbedding } = require("../src/services/embeddings");
const { cosineSimilarity } = require("../src/services/similarity");

async function main() {
  const a = await getEmbedding("Error: Cannot find module '../utils/currency'");
  const b = await getEmbedding("Error: Cannot find module '../utils/tax'");
  const c = await getEmbedding("FAIL src/cart/applyDiscount.test.js expect(received).toBe(expected)");

  console.log("dims:", a.length);
  console.log("sim(module-not-found A, module-not-found B):", cosineSimilarity(a, b).toFixed(4));
  console.log("sim(module-not-found A, unrelated test failure C):", cosineSimilarity(a, c).toFixed(4));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
