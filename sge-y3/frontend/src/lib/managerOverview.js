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

export function getManagerOverview() {
  return request("/manager/overview");
}

export function getManagerTeamReport() {
  return request("/manager/team-report");
}

export function getManagerSelfEvaluation() {
  return request("/manager/self-evaluation");
}

export function createManagerMissionEvaluation(payload) {
  return request("/manager/self-evaluation/missions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveManagerSelfEvaluation(payload) {
  return request("/manager/self-evaluation", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitManagerSelfEvaluation() {
  return request("/manager/self-evaluation/submit", {
    method: "POST",
  });
}

export function submitManagerMissionEvaluation(missionId) {
  return request("/manager/self-evaluation/missions/submit", {
    method: "POST",
    body: JSON.stringify({ missionId }),
  });
}

export function getManagerMemberEvaluation(memberId) {
  return request(`/manager/members/${memberId}/evaluation`);
}

export function createManagerMemberMission(memberId, payload) {
  return request(`/manager/members/${memberId}/evaluation/missions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveManagerMemberEvaluation(memberId, payload) {
  return request(`/manager/members/${memberId}/evaluation`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitManagerMemberEvaluation(memberId) {
  return request(`/manager/members/${memberId}/evaluation/submit`, {
    method: "POST",
  });
}

export function saveManagerMemberMissionReviews(memberId, payload) {
  return request(`/manager/members/${memberId}/evaluation/missions`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitManagerMemberMissionReview(memberId, missionId) {
  return request(`/manager/members/${memberId}/evaluation/missions/${missionId}/submit`, {
    method: "POST",
    body: JSON.stringify({ missionId }),
  });
}
