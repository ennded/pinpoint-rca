const CHAT_MODEL = "gpt-4o-mini";

let openaiClient = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    const OpenAI = require("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const MOCK_FIX_BY_ERROR_TYPE = {
  ModuleNotFoundError: "Double-check the import path and that the referenced file/module actually exists and is exported.",
  DependencyError: "Resolve the peer dependency conflict by aligning versions in package.json, or add an override/resolution.",
  TestFailure: "Re-run the failing test locally, inspect the assertion diff, and fix the logic or update the expectation if it's stale.",
  TypeError: "Check for an undefined/null value being used where an object or function was expected, and add a guard.",
  SyntaxError: "Look at the reported file/line for a stray bracket, quote, or unsupported syntax for the target runtime.",
  ReferenceError: "An identifier is used before it's defined or imported — check spelling and import order.",
  FileNotFoundError: "The process tried to read a path that doesn't exist — verify the working directory and file path are correct.",
  ConnectionError: "A downstream service refused the connection — verify it's running and reachable from the CI environment.",
  PermissionError: "The process lacks permission for a file or resource — check file modes and the CI runner's permissions.",
  DockerError: "The Docker build/run step failed — check the Dockerfile steps and base image availability.",
  TimeoutError: "A step exceeded its time budget — check for a hang (e.g. waiting on a port) or increase the timeout.",
  GitError: "Git operation failed — check repo permissions, branch existence, or shallow-clone depth settings.",
  LintError: "Linting found style/quality issues — run the linter locally with --fix or address the reported rules.",
  BuildFailure: "The build step failed — check the build tool's output above this line for the root compilation error.",
  // Kubernetes error types
  CrashLoopBackOff: "Check `kubectl logs --previous` for the container's crash reason — usually a bad startup config or an unhandled exception.",
  ImagePullBackOff: "Verify the image name/tag exists in the registry and the cluster has valid pull credentials (imagePullSecrets).",
  OOMKilled: "The container exceeded its memory limit — profile memory usage and raise `resources.limits.memory` or fix the leak.",
  ProbeFailure: "The liveness/readiness probe is failing — check the probe path/port and whether the app is slow to start.",
  SchedulingFailure: "The scheduler couldn't place the pod — check node resource availability, taints/tolerations, and affinity rules.",
  ConfigError: "A ConfigMap or Secret referenced by the pod is missing or misnamed — verify it exists in the same namespace.",
  UnknownError: "Re-run the job with debug logging enabled to get more detail on what failed.",
};

const MOCK_CATEGORY_BY_ERROR_TYPE = {
  ModuleNotFoundError: "dependency",
  DependencyError: "dependency",
  ImagePullBackOff: "dependency",
  TestFailure: "test",
  LintError: "test",
  TypeError: "build",
  SyntaxError: "build",
  ReferenceError: "build",
  BuildFailure: "build",
  FileNotFoundError: "config",
  ConfigError: "config",
  GitError: "config",
  ConnectionError: "network",
  TimeoutError: "network",
  PermissionError: "infrastructure",
  DockerError: "infrastructure",
  CrashLoopBackOff: "infrastructure",
  OOMKilled: "infrastructure",
  ProbeFailure: "infrastructure",
  SchedulingFailure: "infrastructure",
  UnknownError: "config",
};

const HIGH_SEVERITY_ERROR_TYPES = new Set([
  "ConnectionError",
  "DockerError",
  "CrashLoopBackOff",
  "OOMKilled",
  "SchedulingFailure",
  "PermissionError",
]);
const LOW_SEVERITY_ERROR_TYPES = new Set(["TestFailure", "LintError"]);
// Naive stand-in for "business criticality" — a real system would look this
// up from a service registry rather than pattern-match the name.
const CRITICAL_SERVICE_HINTS = ["payment", "checkout", "auth", "billing"];

function mockSeverity(errorType, service) {
  let level = LOW_SEVERITY_ERROR_TYPES.has(errorType)
    ? "low"
    : HIGH_SEVERITY_ERROR_TYPES.has(errorType)
    ? "high"
    : "medium";

  const isCriticalService = CRITICAL_SERVICE_HINTS.some((hint) => service.toLowerCase().includes(hint));
  if (isCriticalService && level === "medium") level = "high";
  if (isCriticalService && level === "low") level = "medium";

  return level;
}

function mockExplain({ errorType, service, keyLine, matchedIncident }) {
  const explanation = matchedIncident
    ? `This ${errorType} in "${service}" (${keyLine}) looks similar to a past incident (${(matchedIncident.score * 100).toFixed(0)}% match) also caused by a ${matchedIncident.incident.errorType} in "${matchedIncident.incident.service}". It's likely the same class of issue recurring.`
    : `This is a ${errorType} in the "${service}" build. The key failing line was: "${keyLine}". This doesn't closely match any past incident, so treat it as a new failure mode.`;

  const fix = matchedIncident
    ? `Last time this pattern occurred, the fix was: "${matchedIncident.incident.fix}". Start there and verify it applies to this instance.`
    : MOCK_FIX_BY_ERROR_TYPE[errorType] || MOCK_FIX_BY_ERROR_TYPE.UnknownError;

  return {
    explanation,
    fix,
    severity: mockSeverity(errorType, service),
    category: MOCK_CATEGORY_BY_ERROR_TYPE[errorType] || "config",
  };
}

const SYSTEM_PROMPT = `You are RootCause AI, a DevOps assistant that explains CI/CD and Kubernetes failures in plain English and suggests a concrete fix.
Respond ONLY with a JSON object of the form {"explanation": string, "fix": string, "severity": "low"|"medium"|"high", "category": "database"|"config"|"dependency"|"network"|"build"|"test"|"infrastructure"}.
"severity" is the business impact if this isn't fixed soon, considering both the error type and how critical the affected service sounds.
"category" is the root-cause category that best fits.
Keep "explanation" to 2-4 sentences. Keep "fix" to 1-3 concrete, actionable sentences.`;

function buildUserPrompt({ errorType, service, keyLine, rawLog, matchedIncident }) {
  let prompt = `Service: ${service}\nDetected error type: ${errorType}\nKey error line: ${keyLine}\n\nRelevant log excerpt:\n${rawLog.slice(0, 4000)}`;

  if (matchedIncident) {
    prompt += `\n\nA similar past incident was found (similarity ${(matchedIncident.score).toFixed(2)}):
Past error type: ${matchedIncident.incident.errorType}
Past key line: ${matchedIncident.incident.keyLine}
Past explanation: ${matchedIncident.incident.explanation}
Past fix that resolved it: ${matchedIncident.incident.fix}
Use this as context — if it's genuinely the same root cause, say so and lean on the past fix.`;
  }

  return prompt;
}

/**
 * @param {{ errorType: string, service: string, keyLine: string, rawLog: string, matchedIncident?: { incident: object, score: number } | null }} params
 * @returns {Promise<{ explanation: string, fix: string, severity: string, category: string }>}
 */
async function explainError(params) {
  const client = getClient();
  if (!client) {
    return mockExplain(params);
  }

  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(params) },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return {
    explanation: parsed.explanation,
    fix: parsed.fix,
    severity: parsed.severity,
    category: parsed.category,
  };
}

module.exports = { explainError, CHAT_MODEL };
