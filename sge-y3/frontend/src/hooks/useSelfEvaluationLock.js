import { useEffect, useState } from "react";

import { SELF_EVALUATION_CLOSED_EVENT } from "@/api/auth";
import { getActiveCycleInfo, resetActiveEvaluationPeriod } from "@/api/evaluationPeriod";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

// État de blocage des auto-évaluations du cycle actif.
// isClosed : la page doit passer en lecture seule (date limite atteinte, ou refus 403 du serveur).
// scheduledDeadline : date limite programmée mais pas encore atteinte.
export function useSelfEvaluationLock() {
  const [deadline, setDeadline] = useState(null);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function load() {
      getActiveCycleInfo()
        .then((info) => {
          if (cancelled) return;
          setDeadline(info.self_evaluation_deadline || null);
          setIsClosed((current) => current || info.self_evaluation_closed);
        })
        .catch(() => {});
    }

    // Le serveur a refusé un enregistrement : la période a été close pendant que la page était ouverte.
    function handleClosed() {
      if (cancelled) return;
      setIsClosed(true);
      resetActiveEvaluationPeriod();
      load();
    }

    load();
    window.addEventListener(SELF_EVALUATION_CLOSED_EVENT, handleClosed);

    return () => {
      cancelled = true;
      window.removeEventListener(SELF_EVALUATION_CLOSED_EVENT, handleClosed);
    };
  }, []);

  // Date limite atteinte pendant que la page est ouverte.
  useEffect(() => {
    if (isClosed || !deadline) return undefined;
    const remaining = new Date(deadline).getTime() - Date.now();
    if (Number.isNaN(remaining) || remaining > MAX_TIMER_DELAY_MS) return undefined;

    const timer = setTimeout(() => {
      resetActiveEvaluationPeriod();
      getActiveCycleInfo().catch(() => {});
      setIsClosed(true);
    }, Math.max(remaining, 0));

    return () => clearTimeout(timer);
  }, [deadline, isClosed]);

  return {
    isClosed,
    deadline,
    scheduledDeadline: !isClosed && deadline ? deadline : null,
  };
}
