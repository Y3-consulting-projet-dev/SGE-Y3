import { loadSession } from "@/api/auth";

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

export async function downloadMyAssistantResults() {
  const session = loadSession();
  const headers = {};

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/collaborator/results/me/download`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Telechargement impossible.");
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  const filename = quotedMatch?.[1] || "mes-resultats.pdf";

  return { blob, filename };
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

export function saveMyDevelopmentPlan(payload) {
  return request("/collaborator/development/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitMyDevelopmentPlan(managerId) {
  return request("/collaborator/development/me/submit", {
    method: "POST",
    body: JSON.stringify({ managerId }),
  });
}
