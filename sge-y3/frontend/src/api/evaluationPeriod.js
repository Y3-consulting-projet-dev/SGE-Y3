import { authFetch, loadSession, setSelfEvaluationClosed } from "@/api/auth";

import { API_BASE_URL } from "./apiBase";

let cachedCycleInfoPromise = null;

// Message identique à celui du serveur, avec la date limite en fr-FR (UTC).
export function formatSelfEvaluationDate(value, { withTime = false } = {}) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  const formatted = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const day = date.getUTCDate() === 1 ? formatted.replace(/^1 /, "1er ") : formatted;

  if (!withTime) return day;

  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day} à ${time}`;
}

export function getSelfEvaluationClosedMessage(deadline) {
  const date = formatSelfEvaluationDate(deadline);
  return `La période d'auto-évaluation est close${date ? ` depuis le ${date}` : ""}. Les modifications ne sont plus possibles.`;
}

// Informations du cycle actif renvoyées par GET /api/cycles/active :
// { period: { label, start_date, end_date }, self_evaluation_deadline, self_evaluation_closed }.
// Chargées une seule fois et partagées par toutes les pages ; en cas d'échec, nouvelle tentative au prochain appel.
export function getActiveCycleInfo() {
  if (!cachedCycleInfoPromise) {
    const session = loadSession();
    cachedCycleInfoPromise = authFetch(`${API_BASE_URL}/cycles/active`, {
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.period?.start_date) {
          throw new Error(data.message || "Période évaluée indisponible.");
        }
        const info = {
          period: data.period,
          self_evaluation_deadline: data.self_evaluation_deadline || null,
          self_evaluation_closed: Boolean(data.self_evaluation_closed),
        };
        setSelfEvaluationClosed(info.self_evaluation_closed ? getSelfEvaluationClosedMessage(info.self_evaluation_deadline) : "");
        return info;
      })
      .catch((error) => {
        cachedCycleInfoPromise = null;
        throw error;
      });
  }

  return cachedCycleInfoPromise;
}

// Période évaluée du cycle actif ({ label, start_date, end_date } au format AAAA-MM-JJ).
export function getActiveEvaluationPeriod() {
  return getActiveCycleInfo().then((info) => info.period);
}

// À appeler quand la RH lance un nouveau cycle ou modifie la date limite des auto-évaluations.
export function resetActiveEvaluationPeriod() {
  cachedCycleInfoPromise = null;
}
