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

export function getAssociateOverview() {
  return request("/associate/overview");
}

export function getAssociateSyntheses() {
  return request("/associate/syntheses");
}

export function getAssociateSelfEvaluation() {
  return request("/associate/self-evaluation");
}

export function saveAssociateSelfEvaluation(payload) {
  return request("/associate/self-evaluation", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitAssociateSelfEvaluation() {
  return request("/associate/self-evaluation/submit", {
    method: "POST",
  });
}

export function getReceivedAssociateEvaluations(scope = "") {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  return request(`/associate/received-evaluations${query}`);
}

export function getReceivedAssociateEvaluation(evaluationId) {
  return request(`/associate/received-evaluations/${evaluationId}`);
}

export function saveReceivedAssociateEvaluationComment(evaluationId, payload) {
  return request(`/associate/received-evaluations/${evaluationId}/comment`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitReceivedAssociateEvaluationToRh(evaluationId) {
  return request(`/associate/received-evaluations/${evaluationId}/submit-rh`, {
    method: "POST",
  });
}

export function getAssociateManagerEvaluations() {
  return request("/associate/manager-evaluations");
}

export function getAssociateManagerEvaluation(managerId) {
  return request(`/associate/manager-evaluations/${managerId}`);
}

export function saveAssociateManagerEvaluation(managerId, payload) {
  return request(`/associate/manager-evaluations/${managerId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getAssociateSupportEvaluations() {
  return request("/associate/support-evaluations");
}

export function getAssociateSupportEvaluation(supportId) {
  return request(`/associate/support-evaluations/${supportId}`);
}

export function saveAssociateSupportEvaluation(supportId, payload) {
  return request(`/associate/support-evaluations/${supportId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })}
    
export function submitAssociateManagerEvaluationToRh(managerId, payload) {
  return request(`/associate/manager-evaluations/${managerId}/submit-rh`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
