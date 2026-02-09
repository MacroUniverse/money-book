const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export function fetchMetadata() {
  return request("/metadata");
}

export function fetchRecords({ from, to }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/records?${params.toString()}`);
}

export function fetchStats({ from, to }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/stats?${params.toString()}`);
}

export function createRecord(payload) {
  return request("/records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function undoLast() {
  return request("/undo", { method: "POST" });
}

export function createAccount(payload) {
  return request("/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createTag(payload) {
  return request("/tags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createTargetTag(payload) {
  return request("/target-tags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createTarget(payload) {
  return request("/targets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
