const API_BASE = "/api";

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const listBuilds = (category) =>
  request(category ? `/builds?category=${encodeURIComponent(category)}` : "/builds");

export const getBuild = (id) => request(`/builds/${id}`);

export const analyzeLog = (rawLog, service) =>
  request("/builds/analyze", { method: "POST", body: JSON.stringify({ rawLog, service }) });

export const resolveIncident = (id) =>
  request(`/incidents/${id}/resolve`, { method: "PATCH" });

export const postToPlatform = (platform, id) =>
  request(`/notifications/${platform}/post/${id}`, { method: "POST" });

export const submitFeedback = (id, helpful) =>
  request(`/incidents/${id}/feedback`, { method: "POST", body: JSON.stringify({ helpful }) });

export const getTrend = (days = 30) => request(`/analytics/trend?days=${days}`);

export const seedDemoData = (count = 25) =>
  request("/dev/seed-demo-data", { method: "POST", body: JSON.stringify({ count }) });
