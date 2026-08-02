const EMBEDDING_MODEL = "text-embedding-3-small";
const MOCK_DIMENSIONS = 256;

let openaiClient = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    const OpenAI = require("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Deterministic bag-of-words style embedding used when there's no OpenAI key.
// It's not semantically meaningful the way a real embedding is, but texts
// that share words end up closer in cosine space, which is enough to
// exercise and demo the similarity-search pipeline end to end.
function mockEmbedding(text) {
  const vector = new Array(MOCK_DIMENSIONS).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
    }
    vector[hash % MOCK_DIMENSIONS] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / magnitude);
}

/**
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function getEmbedding(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("getEmbedding: text must be a non-empty string");
  }

  const client = getClient();
  if (!client) {
    return mockEmbedding(text);
  }

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

module.exports = { getEmbedding, mockEmbedding, EMBEDDING_MODEL, MOCK_DIMENSIONS };
