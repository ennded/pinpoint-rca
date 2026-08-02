// Standalone smoke test for the log parser — no DB/API keys needed.
// Run with: node backend/scripts/test-log-parser.js
const fs = require("fs");
const path = require("path");
const { parseLog } = require("../src/services/logParser");

const samplesDir = path.join(__dirname, "..", "samples");
const files = fs.readdirSync(samplesDir).filter((f) => f.endsWith(".log"));

for (const file of files) {
  const rawLog = fs.readFileSync(path.join(samplesDir, file), "utf8");
  const parsed = parseLog(rawLog);
  console.log(`\n=== ${file} ===`);
  console.log(parsed);
}
