import { useEffect, useRef, useState } from "react";

/**
 * Hook générique pour appels async : gère isLoading, error, data.
 * asyncFn doit être stable (useCallback) ou passée via fnRef pour éviter les re-renders.
 */
export function useAsync(asyncFn, deps = []) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    fnRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || "Erreur de chargement.");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, error };
}
