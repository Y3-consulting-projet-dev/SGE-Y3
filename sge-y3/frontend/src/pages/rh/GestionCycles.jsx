import { useEffect, useMemo, useState } from "react";
import { createRhCycle, getRhCycles, updateRhSelfEvaluationDeadline } from "@/api/rhOverview";
import { resetActiveEvaluationPeriod } from "@/api/evaluationPeriod";
import { formatCommentDate } from "@/utils/historiqueUtils";

// La période évaluée va toujours du 1er octobre N au 30 septembre N+1 (règle vérifiée aussi par le serveur).
function getFiscalPeriod(startYear) {
  return {
    startDate: `${startYear}-10-01`,
    endDate: `${startYear + 1}-09-30`,
    label: `Cycle ${startYear}-${startYear + 1}`,
    description: `du 1er octobre ${startYear} au 30 septembre ${startYear + 1}`,
  };
}

// Date et heure de blocage, affichées en UTC (heure d'Abidjan) comme le serveur.
function formatDeadline(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function GestionCycles() {
  const [cycles, setCycles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [startYear, setStartYear] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineMessage, setDeadlineMessage] = useState(null);
  const [isUpdatingDeadline, setIsUpdatingDeadline] = useState(false);

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

  // Exercices proposés : de l'an dernier à l'an prochain, sauf ceux déjà lancés.
  const yearOptions = useMemo(() => {
    const existingLabels = new Set(cycles.map((cycle) => cycle.label));
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1]
      .map((year) => ({ year, ...getFiscalPeriod(year) }))
      .filter((option) => !existingLabels.has(option.label));
  }, [cycles]);

  const selectedPeriod = startYear ? getFiscalPeriod(Number(startYear)) : null;
  const previewLabel = selectedPeriod?.label || "";
  const activeCycle = cycles.find((cycle) => cycle.is_active) || null;
  const activeDeadline = activeCycle?.self_evaluation_deadline || null;

  async function handleDeadlineAction(action) {
    setDeadlineMessage(null);

    if (action === "schedule" && !deadlineDate) {
      setDeadlineMessage({ tone: "error", text: "Veuillez choisir une date de blocage." });
      return;
    }

    const confirmations = {
      schedule: `Programmer le blocage des auto-évaluations à partir du ${formatDeadline(`${deadlineDate}T00:00:00.000Z`)} ?`,
      close_now: "Bloquer maintenant toutes les auto-évaluations ? Plus personne ne pourra enregistrer ni soumettre la sienne.",
      reopen: "Rouvrir les auto-évaluations ? La date de blocage sera supprimée.",
    };

    if (!window.confirm(confirmations[action])) {
      return;
    }

    try {
      setIsUpdatingDeadline(true);
      const response = await updateRhSelfEvaluationDeadline(
        action === "schedule" ? { action, date: deadlineDate } : { action }
      );
      setDeadlineMessage({ tone: "success", text: response?.message || "Modification enregistrée." });
      setDeadlineDate("");
      const refreshed = await getRhCycles();
      setCycles(refreshed?.cycles || []);
    } catch (error) {
      setDeadlineMessage({ tone: "error", text: error.message || "Modification impossible." });
    } finally {
      setIsUpdatingDeadline(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedPeriod) {
      setErrorMessage("Veuillez choisir l'exercice à évaluer.");
      return;
    }

    const confirmed = window.confirm(
      `Lancer ${previewLabel} (${selectedPeriod.description}) ? Toutes les nouvelles évaluations seront créées dans ce cycle et le cycle précédent basculera dans l'historique.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await createRhCycle({ start_date: selectedPeriod.startDate, end_date: selectedPeriod.endDate });
      resetActiveEvaluationPeriod();
      setSuccessMessage(`${response?.cycle?.label || previewLabel} est maintenant le cycle actif.`);
      setStartYear("");
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
          La période évaluée va toujours du 1er octobre au 30 septembre de l'année suivante. Choisissez l'exercice : les dates sont fixées automatiquement.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Exercice évalué</label>
            <select
              value={startYear}
              onChange={(event) => setStartYear(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-[#0F3A63]"
            >
              <option value="">Choisir…</option>
              {yearOptions.map((option) => (
                <option key={option.year} value={option.year}>
                  {option.label} — {option.description}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            {previewLabel ? (
              <p className="text-sm font-semibold text-slate-500">
                Libellé généré : <span className="font-extrabold text-[#0F3A63]">{previewLabel}</span>
                <br />
                Période évaluée : <span className="font-extrabold text-[#0F3A63]">{selectedPeriod.description}</span>
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

      {activeCycle ? (
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#0F3A63]">Blocage des auto-évaluations</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Une fois bloquées, plus personne ne peut enregistrer ni soumettre son auto-évaluation pour {activeCycle.label}.
                Les évaluations faites par les supérieurs, la RH et les associés restent ouvertes.
              </p>
            </div>
            {activeCycle.self_evaluation_closed ? (
              <span className="rounded-full bg-[#FDE8E8] px-3 py-1 text-xs font-bold text-[#B93840]">
                Bloquées depuis le {formatDeadline(activeDeadline)}
              </span>
            ) : activeDeadline ? (
              <span className="rounded-full bg-[#FFF1DC] px-3 py-1 text-xs font-bold text-[#B26A00]">
                Ouvertes — blocage programmé le {formatDeadline(activeDeadline)}
              </span>
            ) : (
              <span className="rounded-full bg-[#E7F4DD] px-3 py-1 text-xs font-bold text-[#3F8F2F]">
                Ouvertes, sans date de blocage
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bloquer à partir du</label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(event) => setDeadlineDate(event.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-[#0F3A63]"
              />
            </div>
            <button
              type="button"
              onClick={() => handleDeadlineAction("schedule")}
              disabled={isUpdatingDeadline}
              className="rounded-full bg-[#0F3A63] px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Programmer le blocage
            </button>
            <button
              type="button"
              onClick={() => handleDeadlineAction("close_now")}
              disabled={isUpdatingDeadline}
              className="rounded-full bg-[#B93840] px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Bloquer maintenant
            </button>
            {activeDeadline ? (
              <button
                type="button"
                onClick={() => handleDeadlineAction("reopen")}
                disabled={isUpdatingDeadline}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-[#0F3A63] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rouvrir les auto-évaluations
              </button>
            ) : null}
          </div>

          {deadlineMessage ? (
            <p
              className={`mt-3 text-sm font-semibold ${
                deadlineMessage.tone === "error" ? "text-red-600" : "text-[#3F8F2F]"
              }`}
            >
              {deadlineMessage.text}
            </p>
          ) : null}
        </section>
      ) : null}

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
