import { useEffect, useMemo, useState } from "react";
import { createRhCycle, getRhCycles } from "@/api/rhOverview";
import { formatCommentDate } from "@/utils/historiqueUtils";

function GestionCycles() {
  const [cycles, setCycles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCycles() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhCycles();
        if (!cancelled) {
          setCycles(response?.cycles || []);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des cycles impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCycles();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewLabel = useMemo(() => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "";
    }

    return `Cycle ${start.getFullYear()}-${end.getFullYear()}`;
  }, [startDate, endDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!startDate || !endDate) {
      setErrorMessage("Veuillez renseigner une date de début et une date de fin.");
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      setErrorMessage("La date de début doit être antérieure à la date de fin.");
      return;
    }

    const confirmed = window.confirm(
      `Lancer ${previewLabel} ? Toutes les nouvelles évaluations seront créées dans ce cycle et le cycle précédent basculera dans l'historique.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await createRhCycle({ start_date: startDate, end_date: endDate });
      setSuccessMessage(`${response?.cycle?.label || previewLabel} est maintenant le cycle actif.`);
      setStartDate("");
      setEndDate("");
      const refreshed = await getRhCycles();
      setCycles(refreshed?.cycles || []);
    } catch (error) {
      setErrorMessage(error.message || "Lancement du cycle impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold text-[#0F3A63]">Lancer une nouvelle saison</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Définissez la période du nouveau cycle d'évaluation. Le libellé est généré automatiquement à partir des dates.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-[#0F3A63]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-[#0F3A63]"
            />
          </div>
          <div className="flex-1">
            {previewLabel ? (
              <p className="text-sm font-semibold text-slate-500">
                Libellé généré : <span className="font-extrabold text-[#0F3A63]">{previewLabel}</span>
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`rounded-full px-5 py-2 text-sm font-bold text-white ${
              isSubmitting ? "cursor-not-allowed bg-slate-300" : "bg-[#8BC53F]"
            }`}
          >
            {isSubmitting ? "Lancement..." : "Lancer ce cycle"}
          </button>
        </form>

        {errorMessage ? <p className="mt-3 text-sm font-semibold text-red-600">{errorMessage}</p> : null}
        {successMessage ? <p className="mt-3 text-sm font-semibold text-[#3F8F2F]">{successMessage}</p> : null}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold text-[#0F3A63]">Cycles d'évaluation</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Historique des saisons d'évaluation lancées par la RH.</p>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <p className="text-sm font-semibold text-slate-500">Chargement des cycles...</p>
          ) : cycles.length ? (
            cycles.map((cycle) => (
              <article key={cycle.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] p-4">
                <div>
                  <p className="text-sm font-extrabold text-[#0F3A63]">{cycle.label}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    Du {formatCommentDate(cycle.start_date)} au {formatCommentDate(cycle.end_date)}
                  </p>
                </div>
                {cycle.is_active ? (
                  <span className="rounded-full bg-[#E7F4DD] px-3 py-1 text-xs font-bold text-[#3F8F2F]">En cours</span>
                ) : (
                  <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-bold text-slate-600">Terminé</span>
                )}
              </article>
            ))
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucun cycle enregistré.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default GestionCycles;
