// Sample failure logs in backend/samples/, used to seed demo history.
const fs = require("fs");
const path = require("path");

const SAMPLES_DIR = path.join(__dirname, "..", "..", "samples");

function listSampleLogs() {
  return fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".log"));
}

module.exports = { listSampleLogs };
