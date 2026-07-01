import { API_BASE_URL } from "./apiBase";
const STORAGE_KEY = "sge-auth-session";

export async function loginUser(credentials) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

function getAuthToken() {
  const session = loadSession();
  return session?.token || null;
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getAuthToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Operation impossible.");
  }

  return data;
}

export async function updateProfile(payload) {
  return request("/auth/me/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updatePassword(payload) {
  return request("/auth/me/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function saveSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadSession() {
  const session = window.localStorage.getItem(STORAGE_KEY);

  if (!session) {
    return null;
  }

  try {
    return JSON.parse(session);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}
