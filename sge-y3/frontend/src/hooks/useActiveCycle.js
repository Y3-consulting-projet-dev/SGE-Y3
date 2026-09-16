import { useEffect, useState } from "react";

import { getActiveCycle } from "@/api/auth";

const FALLBACK_CYCLE_LABEL = "Cycle 2025-2026";

export function useActiveCycle() {
  const [cycleLabel, setCycleLabel] = useState(FALLBACK_CYCLE_LABEL);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getActiveCycle()
      .then((data) => {
        if (cancelled) return;
        if (data?.cycle?.label) {
          setCycleLabel(data.cycle.label);
        }
        if (data?.cycle?.end_date) {
          setEndDate(new Date(data.cycle.end_date));
        }
      })
      .catch(() => {
        // Garde le libellé de repli si la requête échoue.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { cycleLabel, endDate };
}

export function formatDeadlineDate(date) {
  if (!date) return "";

  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function getDaysRemaining(date) {
  if (!date) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = date.getTime() - startOfToday.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getDeadlineBannerState(date) {
  const formattedDate = formatDeadlineDate(date);

  if (!formattedDate) {
    return {
      tone: "info",
      message: "Auto-évaluation en cours. Vos modifications sont enregistrées automatiquement.",
    };
  }

  const daysRemaining = getDaysRemaining(date);
  const daysSuffix =
    typeof daysRemaining === "number" ? ` (il reste ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""})` : "";

  return {
    tone: "info",
    message: `Auto-évaluation en cours - à soumettre avant le ${formattedDate}${daysSuffix}. Sauvegarde automatique activée.`,
  };
}

export function formatDeadlineMessage(date) {
  return getDeadlineBannerState(date).message;
}
