import { API_BASE_URL } from "./apiBase";
const STORAGE_KEY = "sge-auth-session";

export async function loginUser(credentials) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function requestPasswordReset(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(payload) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAuthConfig() {
  return request("/auth/config");
}

export async function recoverWithCode(email, code) {
  return request("/auth/recover", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function createRecoveryCode() {
  return request("/auth/me/recovery-code", { method: "POST" });
}

export async function confirmRecoveryCode() {
  return request("/auth/me/recovery-code/confirm", { method: "POST" });
}

export async function regenerateRecoveryCode(currentPassword) {
  return request("/auth/me/recovery-code/regenerate", {
    method: "POST",
    body: JSON.stringify({ currentPassword }),
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

  const response = await authFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Operation impossible.");
  }

  return data;
}

export const SESSION_EXPIRED_EVENT = "sge-session-expired";
export const SECURITY_STEP_EVENT = "sge-security-step-required";
const SECURITY_STEP_CODES = ["RECOVERY_CODE_REQUIRED"];

// fetch partagé par les modules d'API : une réponse 401 à une requête authentifiée
// signifie que la session a expiré ou a été révoquée (ex. mot de passe modifié).
export async function authFetch(url, options = {}) {
  const response = await fetch(url, options);
  const sentToken = Boolean(options.headers?.Authorization);

  if (response.status === 401 && sentToken) {
    const data = await response.clone().json().catch(() => ({}));
    clearSession();
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRED_EVENT, {
        detail: { message: data.message || "Votre session a expiré. Veuillez vous reconnecter." },
      })
    );
  }

  // Étape obligatoire en attente : code de secours non conservé.
  if (response.status === 403 && sentToken) {
    const data = await response.clone().json().catch(() => ({}));
    if (SECURITY_STEP_CODES.includes(data.code)) {
      window.dispatchEvent(new CustomEvent(SECURITY_STEP_EVENT, { detail: { code: data.code } }));
    }
  }

  return response;
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
