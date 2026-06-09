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
    throw new Error(data.message || "Opération impossible.");
  }

  return data;
}

export function getSupportSelfEvaluation() {
  return request("/support/self-evaluation");
}

export function saveSupportSelfEvaluation(payload) {
  return request("/support/self-evaluation", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function submitSupportSelfEvaluation() {
  return request("/support/self-evaluation/submit", {
    method: "POST",
  });
}
