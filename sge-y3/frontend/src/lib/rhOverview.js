import { loadSession } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

export function getRhOverview() {
  return request("/rh/overview");
}

export function getRhSelfEvaluation() {
  return request("/rh/self-evaluation");
}

export function saveRhSelfEvaluation(payload) {
  return request("/rh/self-evaluation", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitRhSelfEvaluation() {
  return request("/rh/self-evaluation/submit", {
    method: "POST",
  });
}

export function getRhQuestionnaire() {
  return request("/rh/questionnaire");
}

export function createRhQuestionnaireSection(payload) {
  return request("/rh/questionnaire/sections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addRhQuestionnaireQuestion(payload) {
  return request("/rh/questionnaire/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRhDepartmentEvaluations() {
  return request("/rh/department-evaluations");
}

export function getRhCalibration() {
  return request("/rh/calibration");
}

export function getRhPopulation() {
  return request("/rh/population");
}

export function getRhReports() {
  return request("/rh/reports");
}

export function selectRhDepartmentEvaluation(reviewId) {
  return request(`/rh/department-evaluations/${reviewId}/select`, {
    method: "POST",
  });
}

export function getRhValidations() {
  return request("/rh/validations");
}

export function validateRhSelection(reviewIds) {
  return request("/rh/validations/confirm", {
    method: "POST",
    body: JSON.stringify({ reviewIds }),
  });
}

export function getRhSyntheses() {
  return request("/rh/syntheses");
}
