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

export function getMyAssistantEvaluation() {
  return request("/collaborator/evaluation/me");
}

export function getMyAssistantResults() {
  return request("/collaborator/results/me");
}

export function getMyAssistantEvaluationHistory() {
  return request("/collaborator/evaluation/history");
}

export function saveMyAssistantEvaluation(payload) {
  return request("/collaborator/evaluation/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function saveMyChiefComments(chiefComments) {
  return request("/collaborator/evaluation/me", {
    method: "PUT",
    body: JSON.stringify({ chiefComments }),
  });
}

export function submitMyAssistantMissionEvaluation(missionId) {
  return request("/collaborator/evaluation/me/missions/submit", {
    method: "POST",
    body: JSON.stringify({ missionId }),
  });
}

export function submitMyAssistantEvaluation(payload = {}) {
  return request("/collaborator/evaluation/me/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
