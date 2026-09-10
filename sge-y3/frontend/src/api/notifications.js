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

export function getNotifications(limit = 20) {
  return request(`/notifications?limit=${limit}`);
}

export function getUnreadNotificationCount() {
  return request("/notifications/unread-count");
}

export function markNotificationRead(id) {
  return request(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return request("/notifications/read-all", { method: "PATCH" });
}
