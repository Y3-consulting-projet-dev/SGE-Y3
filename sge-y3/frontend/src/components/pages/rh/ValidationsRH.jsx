import { useEffect, useRef, useState } from "react";
import { getRhValidations, validateRhSelection } from "@/api/rhOverview";

function statusClass(status) {
  if (status === "Prêt Associé") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "Ecart à arbitrer") return "bg-[#F9DFDF] text-[#B63232]";
  if (status === "À compléter") return "bg-[#FFF2CC] text-[#8A6810]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function formatScore(score) {
  return typeof score === "number" ? score.toFixed(1) : "--";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function ScoreWithTooltip({ score, details = [] }) {
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isPinned) return undefined;

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsPinned(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsPinned(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPinned]);

  if (typeof score !== "number") {
    return <span className="font-bold text-[#0F3A63]">--</span>;
  }

  return (
    <div ref={containerRef} className="group relative inline-flex">
      <button
        type="button"
        onClick={() => setIsPinned((current) => !current)}
        className="cursor-help font-bold text-[#0F3A63] underline decoration-dotted underline-offset-4"
      >
        {formatScore(score)}
      </button>
      {details.length ? (
        <div
          className={`absolute left-0 top-full z-20 mt-2 w-[320px] rounded-md bg-[#0F3A63] p-4 text-xs text-white shadow-xl transition-opacity duration-150 ${
            isPinned
              ? "pointer-events-auto visible opacity-100"
              : "pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="mb-2 font-bold">Détail des scores calculés</p>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-2">
            {details.map((detail, index) => (
              <div
                key={`${detail.source}-${detail.evaluatorName}-${detail.missionTitle}-${index}`}
                className="border-b border-white/10 pb-2 last:border-b-0 last:pb-0"
              >
                <p className="font-semibold">
                  {detail.source} - {detail.evaluatorName}
                </p>
                <p className="text-[11px] text-slate-200">{detail.evaluatorGrade || "Collaborateur"}</p>
                {detail.missionTitle ? <p className="mt-1 text-[11px] text-slate-200">{detail.missionTitle}</p> : null}
                <p className="mt-1 font-bold text-[#A7F3D0]">{formatScore(detail.score)}/5</p>
                {detail.submittedAt ? <p className="text-[11px] text-slate-300">{formatDate(detail.submittedAt)}</p> : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-semibold text-slate-300">
            Cliquez à l’extérieur ou appuyez sur `Echap` pour fermer.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function groupScoreDetailsByMission(details = []) {
  const missionMap = new Map();

  details.forEach((detail, index) => {
    const missionTitle = detail.missionTitle || "Évaluation globale";
    const missionKey = detail.missionId || missionTitle;
    const current = missionMap.get(missionKey) || {
      title: missionTitle,
      evaluators: [],
      finalScore: null,
    };
    const source = String(detail.source || "");
    const isFinalMissionScore = source.toLowerCase().includes("score final");

    if (isFinalMissionScore) {
      current.finalScore = detail.score;
    } else {
      current.evaluators.push({ ...detail, key: `${missionKey}-${source}-${detail.evaluatorName}-${index}` });
    }

    missionMap.set(missionKey, current);
  });

  return Array.from(missionMap.values());
}

function FinalScoreWithTooltip({ score, details = [] }) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const missionGroups = groupScoreDetailsByMission(details);
  const isVisible = missionGroups.length && (isPinned || isHovered);

  function updatePopoverPosition() {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setPopoverPosition({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 440)),
    });
  }

  useEffect(() => {
    if (!isPinned) return undefined;

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsPinned(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsPinned(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPinned]);

  if (typeof score !== "number") {
    return <span className="font-bold text-[#0F3A63]">--</span>;
  }

  return (
    <div ref={containerRef} className="group relative inline-flex">
      <button
        type="button"
        onClick={() => {
          updatePopoverPosition();
          setIsPinned((current) => !current);
        }}
        onMouseEnter={() => {
          updatePopoverPosition();
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => {
          updatePopoverPosition();
          setIsHovered(true);
        }}
        onBlur={() => setIsHovered(false)}
        className="cursor-help font-black text-[#78B843] underline decoration-dotted underline-offset-4"
      >
        {formatScore(score)}
      </button>
      {missionGroups.length ? (
        <div
          className={`fixed z-50 max-h-[70vh] w-[420px] overflow-y-auto rounded-md bg-[#0F3A63] p-4 text-xs text-white shadow-xl transition-opacity duration-150 ${
            isVisible
              ? "pointer-events-auto visible opacity-100"
              : "pointer-events-none invisible opacity-0"
          }`}
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
          onClick={(event) => event.stopPropagation()}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <p className="mb-2 font-bold">Détail du score final</p>
          <div className="space-y-3 pr-2">
            {missionGroups.map((mission, missionIndex) => (
              <div key={`${mission.title}-${missionIndex}`} className="rounded-md border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-white">{mission.title}</p>
                  <p className="shrink-0 font-black text-[#A7F3D0]">
                    {typeof mission.finalScore === "number" ? `${formatScore(mission.finalScore)}/5` : "--"}
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {mission.evaluators.length ? (
                    mission.evaluators.map((detail) => (
                      <div key={detail.key} className="rounded bg-white/10 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {detail.source} - {detail.evaluatorName}
                            </p>
                            <p className="text-[11px] text-slate-200">{detail.evaluatorGrade || "Collaborateur"}</p>
                          </div>
                          <p className="font-bold text-[#A7F3D0]">{formatScore(detail.score)}/5</p>
                        </div>
                        {detail.submittedAt ? <p className="mt-1 text-[11px] text-slate-300">{formatDate(detail.submittedAt)}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] font-semibold text-slate-300">Aucun évaluateur détaillé pour cette mission.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-semibold text-slate-300">
            Cliquez à l’extérieur ou appuyez sur `Échap` pour fermer.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ValidationsRH({ readOnly = false, onOpenAssistantEvaluation }) {
  const [data, setData] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  async function loadData() {
    setIsLoading(true);
    setErrorMessage("");
    const response = await getRhValidations();
    setData(response);
    setSelectedIds([]);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const response = await getRhValidations();
        if (cancelled) return;
        setData(response);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des validations RH impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.items || [];

  async function handleValidateSelection() {
    if (!selectedIds.length) return;

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const response = await validateRhSelection(selectedIds);
      setFeedbackMessage(response.message || "Sélection RH validée.");
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "Validation RH impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des validations RH...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      {feedbackMessage ? (
        <div className="mb-4 rounded-md bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">{feedbackMessage}</div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Dossiers à valider</h2>
          <p className="text-sm font-semibold text-slate-500">Contrôle RH avant transmission ou décision finale.</p>
        </div>
        <button
          type="button"
          disabled={readOnly || !selectedIds.length || isSubmitting}
          onClick={handleValidateSelection}
          className={`rounded-full px-4 py-2 text-xs font-bold ${
            readOnly || !selectedIds.length || isSubmitting
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-[#8BC53F] text-white"
          }`}
        >
          {readOnly ? "Lecture seule" : isSubmitting ? "Validation..." : "Valider la sélection"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[#F3F6F8] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Choix</th>
              <th className="px-4 py-3">Collaborateur</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Score final</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)
                        )
                      }
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold">{row.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {row.role} - {row.department}
                    </p>
                    {row.sourceType === "assistant-rh-self-evaluation" ? (
                      <button
                        type="button"
                        onClick={() => !readOnly && onOpenAssistantEvaluation?.(row)}
                        disabled={readOnly}
                        className={`mt-2 rounded-full px-3 py-1 text-[11px] font-bold ${
                          readOnly
                            ? "cursor-not-allowed bg-slate-200 text-slate-400"
                            : "bg-[#0D496A] text-white"
                        }`}
                      >
                        Evaluer
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-semibold">{row.managerName}</td>
                  <td className="px-4 py-4">
                    <FinalScoreWithTooltip score={row.rhValidationFinalScore ?? row.finalScore} details={row.missionScoreDetails} />
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.displayStatus)}`}>{row.displayStatus}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center font-semibold text-slate-500">
                  Aucun dossier dans la file de validation RH.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ValidationsRH;
