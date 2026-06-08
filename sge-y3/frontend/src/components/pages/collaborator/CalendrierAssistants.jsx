import { useEffect, useMemo, useState } from "react";
import Calendrier from "@/components/pages/collaborator/Calendrier";

function getAssistantMissions(evaluationData) {
  return (
    evaluationData?.self_evaluation?.missionEvaluations ||
    evaluationData?.selfEvaluation?.missionEvaluations ||
    evaluationData?.mission_evaluations ||
    []
  );
}

function CalendrierAssistants({
  assistants = [],
  ownMissionEvaluations = [],
  ownTitle = "Mon calendrier",
  ownEyebrow = "Mes missions evaluees",
  ownEmptyMessage = "Aucune mission evaluee pour le moment.",
  ownExportFileName = "resultats-mes-missions.xls",
  emptyAssistantsMessage = "Aucun assistant disponible.",
  exportFileNamePrefix = "resultats-mission-assistant",
  fetchAssistantEvaluation,
}) {
  const [selectedScope, setSelectedScope] = useState("self");
  const [evaluationData, setEvaluationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedAssistant = useMemo(
    () => assistants.find((assistant) => String(assistant.id) === String(selectedScope)) || null,
    [assistants, selectedScope]
  );

  useEffect(() => {
    if (selectedScope === "self") {
      setEvaluationData(null);
      setErrorMessage("");
      return undefined;
    }

    if (!selectedAssistant?.id || !fetchAssistantEvaluation) {
      setEvaluationData(null);
      return undefined;
    }

    let cancelled = false;

    async function loadEvaluation() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await fetchAssistantEvaluation(selectedAssistant.id);

        if (!cancelled) {
          setEvaluationData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement du calendrier impossible.");
          setEvaluationData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadEvaluation();

    return () => {
      cancelled = true;
    };
  }, [fetchAssistantEvaluation, selectedAssistant?.id, selectedScope]);

  const isSelfSelected = selectedScope === "self";
  const missionEvaluations = isSelfSelected ? ownMissionEvaluations : getAssistantMissions(evaluationData);
  const calendarTitle = isSelfSelected ? ownTitle : `Calendrier de ${selectedAssistant?.name || "Assistant"}`;
  const calendarEyebrow = isSelfSelected ? ownEyebrow : "Missions assistant evaluees";
  const emptyMessage = isSelfSelected ? ownEmptyMessage : "Aucune mission evaluee pour cet assistant.";
  const exportFileName = isSelfSelected
    ? ownExportFileName
    : `${exportFileNamePrefix}-${selectedAssistant?.name || "assistant"}.xls`.replace(/\s+/g, "-").toLowerCase();

  return (
    <section className="space-y-4">
      <article className="rounded-md bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Mon calendrier</p>
            <h2 className="mt-1 text-xl font-black text-[#0F3A63]">{calendarTitle}</h2>
          </div>

          <select
            value={selectedScope}
            onChange={(event) => setSelectedScope(event.target.value)}
            className="min-w-72 rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-[#0F3A63] outline-none focus:border-[#76B82A]"
          >
            <option value="self">Moi-meme</option>
            {assistants.map((assistant) => (
              <option key={assistant.id} value={assistant.id}>
                {assistant.name} - {assistant.grade || "Assistant"}
              </option>
            ))}
          </select>
        </div>

        {!assistants.length ? (
          <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm font-semibold text-slate-500">{emptyAssistantsMessage}</p>
        ) : selectedAssistant ? (
          <p className="mt-3 rounded-md bg-[#EEF6E8] px-3 py-2 text-xs font-bold text-[#0F3A63]">
            {selectedAssistant.name} - {selectedAssistant.department || "Departement non renseigne"}
          </p>
        ) : null}
      </article>

      {isLoading ? (
        <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement du calendrier...</section>
      ) : errorMessage ? (
        <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>
      ) : (
        <Calendrier
          missionEvaluations={missionEvaluations}
          title={calendarTitle}
          eyebrow={calendarEyebrow}
          emptyMessage={emptyMessage}
          exportFileName={exportFileName}
        />
      )}
    </section>
  );
}

export default CalendrierAssistants;
