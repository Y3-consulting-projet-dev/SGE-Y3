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

export function getSeniorAssistants() {
  return request("/senior/assistants");
}

export function getSeniorOverview() {
  return request("/senior/overview");
}

export function getSeniorCommonMissions() {
  return request("/senior/missions-commones");
}

export function getSeniorTransmittedSummaries() {
  return request("/senior/syntheses-transmises");
}

export function getSeniorAssistantEvaluation(assistantId) {
  return request(`/senior/assistants/${assistantId}/evaluation`);
}

export function addSeniorAssistantMission(assistantId, payload) {
  return request(`/senior/assistants/${assistantId}/evaluation/missions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveSeniorAssistantEvaluation(assistantId, payload) {
  return request(`/senior/assistants/${assistantId}/evaluation`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitSeniorAssistantMissionEvaluation(assistantId, missionId, payload = {}) {
  return request(`/senior/assistants/${assistantId}/evaluation/missions/submit`, {
    method: "POST",
    body: JSON.stringify({ missionId, ...payload }),
  });
}

export function submitSeniorAssistantEvaluation(assistantId, payload = {}) {
  return request(`/senior/assistants/${assistantId}/evaluation/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
