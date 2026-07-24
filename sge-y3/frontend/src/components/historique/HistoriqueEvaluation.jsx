import { useEffect, useState } from "react";
import HistoriqueMissions from "./HistoriqueMissions";
import HistoriqueSections from "./HistoriqueSections";
import { formatCommentDate, formatScore } from "@/utils/historiqueUtils";

function HistoriqueEvaluation({ fetchHistory }) {
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await fetchHistory();

        if (!cancelled) {
          const list = response?.cycles || [];
          setCycles(list);
          setSelectedCycle(list[0]?.cycle_label || null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de l'historique impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement de l'historique...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-md bg-white p-4 text-sm font-semibold text-red-600 shadow-sm">
        {errorMessage}
      </div>
    );
  }

  if (!cycles.length) {
    return (
      <div className="rounded-md bg-white p-6 text-center shadow-sm">
        <p className="text-[14px] font-bold text-[#0F3A63]">Aucun cycle archivé pour le moment</p>
        <p className="mt-2 text-[12px] font-semibold text-slate-500">
          Les évaluations passées apparaîtront ici une fois le cycle en cours clôturé et un nouveau cycle ouvert.
        </p>
      </div>
    );
  }

  const current = cycles.find((cycle) => cycle.cycle_label === selectedCycle) || cycles[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {cycles.map((cycle) => (
          <button
            key={cycle.cycle_label}
            type="button"
            onClick={() => setSelectedCycle(cycle.cycle_label)}
            className={`rounded-md px-4 py-2 text-[12px] font-bold transition ${
              cycle.cycle_label === current.cycle_label
                ? "bg-[#0F3A63] text-white"
                : "bg-white text-[#0F3A63] hover:bg-slate-100"
            }`}
          >
            {cycle.cycle_label}
          </button>
        ))}
      </div>

      {current.start_date && current.end_date ? (
        <p className="text-[12px] font-semibold text-slate-500">
          Période : du {formatCommentDate(current.start_date)} au {formatCommentDate(current.end_date)}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="rounded-md bg-[#003B63] px-4 py-3 text-white">
          <h2 className="mb-4 text-[12px] font-bold">Score final</h2>
          <p className="text-[18px] font-bold text-[#7BC443]">{formatScore(current.kpis?.scoreFinal)}/5</p>
          <p className="mt-3 text-[12px] font-semibold text-slate-200">{current.cycle_label}</p>
        </article>
        <article className="rounded-md bg-[#003B63] px-4 py-3 text-white">
          <h2 className="mb-4 text-[12px] font-bold">Statut évaluation</h2>
          <p className="text-[18px] font-bold text-[#7BC443]">{current.status}</p>
          <p className="mt-3 text-[12px] font-semibold text-slate-200">Cycle archivé</p>
        </article>
      </section>

      {current.kind === "sections" ? <HistoriqueSections cycle={current} /> : <HistoriqueMissions cycle={current} />}
    </div>
  );
}

export default HistoriqueEvaluation;
