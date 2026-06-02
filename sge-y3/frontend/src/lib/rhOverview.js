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

export function getRhOverview() {
  return request("/rh/overview");
}

export function getRhSelfEvaluation() {
  return request("/rh/self-evaluation");
}

export function createRhSelfMissionEvaluation(payload) {
  return request("/rh/self-evaluation/missions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAssistantRhEvaluation(memberId) {
  return request(`/rh/assistant-evaluations/${memberId}`);
}

export function getAssistantRhSelfEvaluation() {
  return request("/rh/assistant-self-evaluation");
}

export function saveRhSelfEvaluation(payload) {
  return request("/rh/self-evaluation", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function saveAssistantRhEvaluation(memberId, payload) {
  return request(`/rh/assistant-evaluations/${memberId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function saveAssistantRhSelfEvaluation(payload) {
  return request("/rh/assistant-self-evaluation", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitRhSelfEvaluation() {
  return request("/rh/self-evaluation/submit", {
    method: "POST",
  });
}

export function submitRhSelfMissionEvaluation(missionId) {
  return request("/rh/self-evaluation/missions/submit", {
    method: "POST",
    body: JSON.stringify({ missionId }),
  });
}

export function submitAssistantRhEvaluation(memberId) {
  return request(`/rh/assistant-evaluations/${memberId}/submit`, {
    method: "POST",
  });
}

export function submitAssistantRhSelfEvaluation() {
  return request("/rh/assistant-self-evaluation/submit", {
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

export function getRhDepartmentEvaluationDetail(reviewId) {
  return request(`/rh/department-evaluations/${reviewId}`);
}

export function getRhCalibration() {
  return request("/rh/calibration");
}

export function getRhPopulation() {
  return request("/rh/population");
}

export function updateRhUserCareer(memberId, payload) {
  return request(`/rh/population/${memberId}/career`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getRhReports() {
  return request("/rh/reports");
}

function getReportFallbackFilename(reportId) {
  if (reportId === "rh-synthese-validee") return "synthese-rh-validee-cycle-2026.pdf";
  if (reportId === "rh-validations") return "file-validations-rh-cycle-2026.csv";
  if (reportId === "rh-calibration") return "calibration-departements-cycle-2026.pdf";
  if (reportId === "rh-population") return "suivi-population-cycle-2026.csv";
  return `${reportId}.bin`;
}

export async function downloadRhReport(reportId) {
  const session = loadSession();
  const headers = {};

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/rh/reports/${reportId}/download`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Telechargement impossible.");
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  const bareMatch = contentDisposition.match(/filename=([^;]+)/i);
  const filename =
    (encodedMatch?.[1] ? decodeURIComponent(encodedMatch[1]) : "") ||
    quotedMatch?.[1] ||
    bareMatch?.[1]?.trim() ||
    getReportFallbackFilename(reportId);

  return { blob, filename };
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

export function submitRhSyntheses() {
  return request("/rh/syntheses/submit", {
    method: "POST",
  });
}
