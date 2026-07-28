import { useEffect, useState } from "react";
import { getRhCalibration } from "@/api/rhOverview";

function CalibrationRH() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCalibration() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhCalibration();
        if (!cancelled) {
          setData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de la calibration impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCalibration();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.items || [];

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de la calibration...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-extrabold text-[#0F3A63]">Calibration des scores</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">Comparaison des moyennes pour identifier les écarts de notation.</p>

      <div className="mt-5 space-y-4">
        {rows.length ? (
          rows.map((row) => (
            <article key={row.department} className="rounded-lg bg-[#F8FAFC] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-extrabold text-[#0F3A63]">{row.department}</p>
                  <p className="text-xs font-semibold text-slate-500">{row.evaluated} évaluations complétées</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-[#78B843]">{typeof row.average === "number" ? row.average : "--"}</p>
                  <p className="text-xs font-bold text-slate-500">{row.risk}</p>
                </div>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-[#4E75C7]" style={{ width: row.width }} />
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Aucune donnée de calibration disponible.
          </div>
        )}
      </div>
    </section>
  );
}

export default CalibrationRH;
