import { useEffect, useMemo, useRef, useState } from "react";
import { PlusCircle, X } from "lucide-react";
import Calendrier from "@/components/pages/collaborator/Calendrier";

function getAssistantMissions(evaluationData) {
  return (
    evaluationData?.self_evaluation?.missionEvaluations ||
    evaluationData?.selfEvaluation?.missionEvaluations ||
    evaluationData?.mission_evaluations ||
    []
  );
}

function formatDisplayDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatPeriod(startDate, endDate) {
  const start = formatDisplayDate(startDate);
  const end = formatDisplayDate(endDate);
  if (start && end) return `Du ${start} au ${end}`;
  if (start) return `À partir du ${start}`;
  if (end) return `Jusqu'au ${end}`;
  return "";
}

function AssignerMissionModal({ assistants, assignMission, assignLabel, onClose }) {
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!selectedId) {
      setFeedback({ tone: "error", message: `Sélectionnez un${assignLabel === "Assistant" ? " assistant" : " membre"}.` });
      return;
    }
    if (!trimmedTitle) {
      setFeedback({ tone: "error", message: "Renseignez le titre de la mission." });
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setFeedback({ tone: "error", message: "La date de fin doit être postérieure ou égale à la date de début." });
      return;
    }

    try {
      setIsSaving(true);
      setFeedback(null);
      const period = formatPeriod(startDate, endDate);
      const response = await assignMission(selectedId, { title: trimmedTitle, period });
      setFeedback({ tone: "success", message: response.message || "Mission assignée avec succès." });
      closeTimerRef.current = setTimeout(() => onClose(), 1500);
    } catch (error) {
      setFeedback({ tone: "error", message: error.message || "Assignation impossible." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-black text-[#0F3A63]">Assigner une mission</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <p className="text-xs font-semibold text-slate-500">
            La mission apparaîtra immédiatement dans l'auto-évaluation et le calendrier.
          </p>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#0F3A63]">{assignLabel}</label>
            {assistants.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun {assignLabel === "Assistant" ? "assistant" : "membre"} rattaché.</p>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63] outline-none focus:border-[#001871]"
              >
                <option value="">Sélectionner...</option>
                {assistants.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.department ? ` — ${item.department}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#0F3A63]">Titre de la mission</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Audit des immobilisations - Client X"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63] outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-[#001871]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#0F3A63]">Date de début</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F3A63] outline-none focus:border-[#001871]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#0F3A63]">Date de fin</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F3A63] outline-none focus:border-[#001871]"
              />
            </div>
          </div>

          {feedback ? (
            <p className={`text-[12px] font-semibold ${feedback.tone === "error" ? "text-[#B93840]" : "text-[#4E8B1B]"}`}>
              {feedback.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || assistants.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-[#001871] px-5 py-2 text-sm font-bold text-white hover:bg-[#001260] disabled:opacity-60"
            >
              <PlusCircle size={14} />
              {isSaving ? "Assignation..." : "Assigner"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  assignMission,
  assignLabel = "Assistant",
}) {
  const [selectedScope, setSelectedScope] = useState("self");
  const [evaluationData, setEvaluationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

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

          <div className="flex flex-wrap items-center gap-2">
            {assignMission ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-[#001871] px-4 py-2 text-xs font-bold text-white hover:bg-[#001260]"
              >
                <PlusCircle size={13} />
                ASSIGNER UNE MISSION
              </button>
            ) : null}

            <select
              value={selectedScope}
              onChange={(event) => setSelectedScope(event.target.value)}
              className="min-w-72 rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-[#0F3A63] outline-none focus:border-[#78BE20]"
            >
              <option value="self">Moi-meme</option>
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.name} - {assistant.grade || "Assistant"}
                </option>
              ))}
            </select>
          </div>
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

      {isModalOpen && assignMission ? (
        <AssignerMissionModal
          assistants={assistants}
          assignMission={assignMission}
          assignLabel={assignLabel}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </section>
  );
}

export default CalendrierAssistants;
