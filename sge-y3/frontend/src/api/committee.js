import { loadSession } from "@/api/auth";

import { API_BASE_URL } from "./apiBase";

function getCommitteeDecisionStorageKey(scope = "associate-final") {
  return `sge-committee-latest-decision:${scope}`;
}

function saveLocalDecision(payload) {
  const scope = payload.scope || "associate-final";
  const decision = {
    id: `local-${Date.now()}`,
    cycle_label: payload.cycle_label || "Cycle 2025-2026",
    scope,
    decisions: payload.decisions || {},
    submitted_by_name: "Associes",
    submitted_at: new Date().toISOString(),
    local_only: true,
  };

  window.localStorage.setItem(getCommitteeDecisionStorageKey(scope), JSON.stringify(decision));
  return decision;
}

function loadLocalDecision(scope = "associate-final") {
  const storageKey = getCommitteeDecisionStorageKey(scope);
  const rawDecision = window.localStorage.getItem(storageKey);

  if (!rawDecision) {
    return null;
  }

  try {
    const decision = JSON.parse(rawDecision);
    return decision?.scope === scope ? decision : null;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function countFilledIncreaseRates(decision) {
  const decisions = decision?.decisions || {};

  return Object.values(decisions).reduce((total, participants) => {
    if (!Array.isArray(participants)) {
      return total;
    }

    return total + participants.filter((participant) => String(participant?.increaseRate ?? "").trim() !== "").length;
  }, 0);
}

function pickMostCompleteDecision(serverDecision, localDecision) {
  if (!serverDecision) {
    return localDecision;
  }

  if (!localDecision) {
    return serverDecision;
  }

  return countFilledIncreaseRates(localDecision) > countFilledIncreaseRates(serverDecision) ? localDecision : serverDecision;
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

export async function saveCommitteeDecision(payload) {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
  };
  const localDecision = saveLocalDecision(payload);

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
      return {
        message: "Decision sauvegardee localement pour la RH.",
        decision: localDecision,
        localFallback: true,
      };
    }

    const decision = data.decision
      ? {
          ...data.decision,
          decisions: payload.decisions || data.decision.decisions || {},
        }
      : localDecision;
    window.localStorage.setItem(getCommitteeDecisionStorageKey(payload.scope || "associate-final"), JSON.stringify(decision));
    return {
      ...data,
      decision,
    };
  } catch {
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
  const localDecision = loadLocalDecision(scope);

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/committee/decisions/latest?scope=${encodeURIComponent(scope)}`, {
      headers,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { decision: localDecision };
    }

    return {
      ...data,
      decision: pickMostCompleteDecision(data.decision, localDecision),
    };
  } catch {
    return { decision: localDecision };
  }
}
