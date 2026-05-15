import { loadSession } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const COMMITTEE_DECISION_STORAGE_KEY = "sge-committee-latest-decision";

function saveLocalDecision(payload) {
  const decision = {
    id: `local-${Date.now()}`,
    cycle_label: payload.cycle_label || "Cycle 2025-2026",
    scope: payload.scope || "associate-final",
    decisions: payload.decisions || {},
    submitted_by_name: "Associés",
    submitted_at: new Date().toISOString(),
    local_only: true,
  };

  window.localStorage.setItem(COMMITTEE_DECISION_STORAGE_KEY, JSON.stringify(decision));
  return decision;
}

function loadLocalDecision(scope = "associate-final") {
  const rawDecision = window.localStorage.getItem(COMMITTEE_DECISION_STORAGE_KEY);

  if (!rawDecision) {
    return null;
  }

  try {
    const decision = JSON.parse(rawDecision);
    return decision?.scope === scope ? decision : null;
  } catch (_error) {
    window.localStorage.removeItem(COMMITTEE_DECISION_STORAGE_KEY);
    return null;
  }
}

export async function getCommitteeParticipants(scope = "collaborators") {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/committee/participants?scope=${encodeURIComponent(scope)}`, {
    headers,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Chargement du comite impossible.");
  }

  return data;
}

export async function getCommitteeOverview() {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/committee/overview`, {
    headers,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Chargement de la vue associe impossible.");
  }

  return data;
}

export async function saveCommitteeDecision(payload) {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/committee/decisions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const localDecision = saveLocalDecision(payload);
      return {
        message: "Decision sauvegardee localement pour la RH.",
        decision: localDecision,
        localFallback: true,
      };
    }

    const decision = data.decision || saveLocalDecision(payload);
    window.localStorage.setItem(COMMITTEE_DECISION_STORAGE_KEY, JSON.stringify(decision));
    return data;
  } catch (_error) {
    const localDecision = saveLocalDecision(payload);
    return {
      message: "Decision sauvegardee localement pour la RH.",
      decision: localDecision,
      localFallback: true,
    };
  }
}

export async function getLatestCommitteeDecision(scope = "associate-final") {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/committee/decisions/latest?scope=${encodeURIComponent(scope)}`, {
      headers,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const localDecision = loadLocalDecision(scope);
      return { decision: localDecision };
    }

    return data.decision ? data : { decision: loadLocalDecision(scope) };
  } catch (_error) {
    return { decision: loadLocalDecision(scope) };
  }
}
