import { authFetch, loadSession } from "@/api/auth";

import { API_BASE_URL } from "./apiBase";

let cachedPeriodPromise = null;

// Période évaluée du cycle actif ({ label, start_date, end_date } au format AAAA-MM-JJ).
// Chargée une seule fois par session de page ; en cas d'échec, une nouvelle tentative aura lieu au prochain appel.
export function getActiveEvaluationPeriod() {
  if (!cachedPeriodPromise) {
    const session = loadSession();
    cachedPeriodPromise = authFetch(`${API_BASE_URL}/cycles/active`, {
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.period?.start_date) {
          throw new Error(data.message || "Période évaluée indisponible.");
        }
        return data.period;
      })
      .catch((error) => {
        cachedPeriodPromise = null;
        throw error;
      });
  }

  return cachedPeriodPromise;
}

// À appeler quand la RH lance un nouveau cycle.
export function resetActiveEvaluationPeriod() {
  cachedPeriodPromise = null;
}
