import { loadSession } from "@/lib/auth";

import { API_BASE_URL } from "./apiBase";

async function request(path, options = {}) {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Operation impossible.");
    error.details = data;
    throw error;
  }

  return data;
}

export function getMySeniorEvaluation() {
  return request("/senior/evaluation/me");
}

export function getMySeniorEvaluationHistory() {
  return request("/senior/evaluation/history");
}

export function saveMySeniorEvaluation(payload) {
  return request("/senior/evaluation/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitMySeniorMissionEvaluation(missionId) {
  return request("/senior/evaluation/me/missions/submit", {
    method: "POST",
    body: JSON.stringify({ missionId }),
  });
}

export function submitMySeniorEvaluation() {
  return request("/senior/evaluation/me/submit", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
