import { useEffect, useState } from "react";

import { getActiveEvaluationPeriod } from "@/api/evaluationPeriod";

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatFrenchDate(isoDate) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day === 1 ? "1er" : day} ${MONTHS_FR[month - 1]} ${year}`;
}

// Période évaluée du cycle actif, pour borner les dates de mission (attributs min/max des champs date).
// Le serveur refuse de toute façon une date hors période ; ce hook évite seulement de la saisir.
export function useEvaluationPeriod() {
  const [period, setPeriod] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getActiveEvaluationPeriod()
      .then((value) => {
        if (!cancelled) setPeriod(value);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const minDate = period?.start_date || undefined;
  const maxDate = period?.end_date || undefined;
  const description = period
    ? `du ${formatFrenchDate(period.start_date)} au ${formatFrenchDate(period.end_date)}`
    : "";

  // Message d'erreur si une date manque ou sort de la période, sinon "".
  function validateMissionDates(startDate, endDate) {
    if (!startDate || !endDate) return "Renseignez la date de début et la date de fin de la mission.";
    if (!period) return "";
    const outOfRange = [startDate, endDate].some(
      (value) => value && (value < period.start_date || value > period.end_date)
    );
    return outOfRange ? `Les dates de la mission doivent être comprises dans la période évaluée, ${description}.` : "";
  }

  return { period, minDate, maxDate, description, validateMissionDates };
}
