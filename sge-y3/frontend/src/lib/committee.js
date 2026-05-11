import { loadSession } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function getCommitteeParticipants() {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/committee/participants`, {
    headers,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Chargement du comite impossible.");
  }

  return data;
}
