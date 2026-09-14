import { useEffect, useState } from "react";

import { getActiveCycle } from "@/api/auth";

const FALLBACK_CYCLE_LABEL = "Cycle 2025-2026";

export function useActiveCycle() {
  const [cycleLabel, setCycleLabel] = useState(FALLBACK_CYCLE_LABEL);

  useEffect(() => {
    let cancelled = false;

    getActiveCycle()
      .then((data) => {
        if (!cancelled && data?.cycle?.label) {
          setCycleLabel(data.cycle.label);
        }
      })
      .catch(() => {
        // Garde le libellé de repli si la requête échoue.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return cycleLabel;
}
