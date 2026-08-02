// Heuristic parser for failure logs. Handles two log families:
//  - CI/CD build logs (GitHub Actions job output)
//  - Kubernetes deployment logs (`kubectl describe pod` / pod events)
// Both are turned into the same small structured summary that's cheap to
// embed and cheap for an LLM to reason about.

// Ordered from most specific to least specific — first match wins.
const CI_ERROR_TYPE_RULES = [
  { type: "SyntaxError", pattern: /\bSyntaxError\b/i },
  { type: "TypeError", pattern: /\bTypeError\b/i },
  { type: "ReferenceError", pattern: /\bReferenceError\b/i },
  { type: "ModuleNotFoundError", pattern: /Cannot find module|ModuleNotFoundError|ERR_MODULE_NOT_FOUND/i },
  { type: "FileNotFoundError", pattern: /\bENOENT\b/ },
  { type: "ConnectionError", pattern: /\bECONNREFUSED\b|\bECONNRESET\b|connect ETIMEDOUT/ },
  { type: "PermissionError", pattern: /\bEACCES\b|Permission denied/i },
  { type: "DockerError", pattern: /docker(:|\s).*(error|failed)|failed to build docker image/i },
  { type: "TimeoutError", pattern: /\btimeout\b|timed out/i },
  { type: "GitError", pattern: /^fatal:/im },
  { type: "TestFailure", pattern: /\d+\s+failing|Tests:\s+\d+\s+failed|FAIL\s+\S+\.(test|spec)\./ },
  { type: "DependencyError", pattern: /npm ERR!|ERESOLVE|peer dep missing/i },
  { type: "LintError", pattern: /\d+\s+problems?\s+\(\d+\s+errors?/i },
  { type: "BuildFailure", pattern: /build failed|compilation failed/i },
];

// Lines matching these (in priority order) are candidates for "the" key line.
// Specific error lines are checked before the generic GitHub Actions
// "##[error]Process completed with exit code N" annotation, which is emitted
// on every failed step and carries no diagnostic detail on its own.
const CI_KEY_LINE_RULES = [
  /^Error:\s*.+/im,
  /^npm ERR!\s*.+/m,
  /^fatal:\s*.+/im,
  /\bTypeError:\s*.+/,
  /\bReferenceError:\s*.+/,
  /\bSyntaxError:\s*.+/,
  /^FAIL\s+.+/m,
  /\d+\s+failing/,
  /Exception in thread .+/,
  /^E\s{3}.+/m, // pytest-style assertion line
  /##\[error\]\s*(?!Process completed with exit code)(.+)/i,
];

// Recognize "service/app" names from common monorepo path conventions or an
// explicit marker line we control in our own simulated logs (`Job: <name>`).
const CI_SERVICE_RULES = [
  /^Job:\s*(\S+)/im,
  /^Running job for service\s+(\S+)/im,
  /(?:services|apps|packages)\/([a-zA-Z0-9_-]+)\//,
];

const K8S_ERROR_TYPE_RULES = [
  { type: "CrashLoopBackOff", pattern: /\bCrashLoopBackOff\b/ },
  { type: "ImagePullBackOff", pattern: /\bImagePullBackOff\b|\bErrImagePull\b/ },
  { type: "OOMKilled", pattern: /\bOOMKilled\b/ },
  { type: "ProbeFailure", pattern: /Liveness probe failed|Readiness probe failed/i },
  { type: "SchedulingFailure", pattern: /FailedScheduling|Insufficient (cpu|memory)/i },
  { type: "ConfigError", pattern: /CreateContainerConfigError|configmap .* not found|secret .* not found/i },
];

// Kubernetes event tables list oldest-first, so the LAST matching Warning
// line is the most recent — and usually most relevant — event.
const K8S_WARNING_LINE = /^\s*Warning\s+\S+.*$/gm;

const K8S_SERVICE_RULES = [
  /^\s*Labels:.*?\bapp(?:\.kubernetes\.io\/name)?=([a-zA-Z0-9_-]+)/m,
  /^Name:\s*(\S+)/m,
];

// Signals this is `kubectl describe pod` / pod-event output rather than a
// CI build log.
function isKubernetesLog(text) {
  return (
    /^Namespace:\s/im.test(text) ||
    /^Name:\s*\S+[\r\n]+Namespace:/m.test(text) ||
    /\bCrashLoopBackOff\b/.test(text) ||
    /\bImagePullBackOff\b/.test(text) ||
    /Type\s+Reason\s+Age\s+From\s+Message/.test(text)
  );
}

function firstMatch(text, rules) {
  for (const rule of rules) {
    const match = text.match(rule);
    if (match) {
      return (match[1] || match[0]).trim();
    }
  }
  return null;
}

function truncate(str, max) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function detectErrorType(text, rules) {
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return "UnknownError";
}

function detectCiKeyLine(text) {
  const match = firstMatch(text, CI_KEY_LINE_RULES);
  if (match) return truncate(match, 500);

  // Fallback: last non-empty line is often the most specific one in a
  // failing CI job (the final "and here's why we exited 1" line).
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? truncate(lines[lines.length - 1], 500) : "";
}

function detectK8sKeyLine(text) {
  const warnings = text.match(K8S_WARNING_LINE);
  if (warnings && warnings.length) return truncate(warnings[warnings.length - 1].trim(), 500);

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? truncate(lines[lines.length - 1], 500) : "";
}

// Pod names are "<deployment>-<replicaset-hash>-<pod-hash>" — strip the
// trailing hash segments to recover the deployment/service name.
function stripPodHashSuffix(name) {
  return name.replace(/(-[a-f0-9]{6,10}){1,2}(-[a-z0-9]{5})?$/i, "") || name;
}

function detectService(text, rules, { isK8s = false } = {}) {
  const match = firstMatch(text, rules);
  if (!match) return "unknown-service";
  return isK8s ? stripPodHashSuffix(match) : match;
}

/**
 * @param {string} rawLog
 * @returns {{ errorType: string, service: string, keyLine: string, logFormat: "kubernetes" | "ci" }}
 */
function parseLog(rawLog) {
  if (typeof rawLog !== "string" || !rawLog.trim()) {
    throw new Error("parseLog: rawLog must be a non-empty string");
  }

  if (isKubernetesLog(rawLog)) {
    return {
      logFormat: "kubernetes",
      errorType: detectErrorType(rawLog, K8S_ERROR_TYPE_RULES),
      service: detectService(rawLog, K8S_SERVICE_RULES, { isK8s: true }),
      keyLine: detectK8sKeyLine(rawLog),
    };
  }

  return {
    logFormat: "ci",
    errorType: detectErrorType(rawLog, CI_ERROR_TYPE_RULES),
    service: detectService(rawLog, CI_SERVICE_RULES),
    keyLine: detectCiKeyLine(rawLog),
  };
}

module.exports = { parseLog };
