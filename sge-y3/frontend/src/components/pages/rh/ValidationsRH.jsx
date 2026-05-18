import { useEffect, useState } from "react";
import { getRhValidations, validateRhSelection } from "@/lib/rhOverview";

function statusClass(status) {
  if (status === "Prêt Associé") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "Ecart à arbitrer") return "bg-[#F9DFDF] text-[#B63232]";
  if (status === "À compléter") return "bg-[#FFF2CC] text-[#8A6810]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function buildMissionHeader(baseLabel, rows, countKey) {
  const counts = [...new Set(rows.map((row) => row[countKey]).filter((count) => typeof count === "number" && count >= 0))];

  if (counts.length === 1) {
    return `${baseLabel} (${counts[0]} mission${counts[0] > 1 ? "s" : ""})`;
  }

  return `${baseLabel} (nb missions)`;
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
  const missionHeader = buildMissionHeader("Score mission", rows, "missionScoreCount");
  const managerMissionHeader = buildMissionHeader("Score manager mission", rows, "managerMissionScoreCount");

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
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#F3F6F8] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Choix</th>
              <th className="px-4 py-3">Collaborateur</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">{missionHeader}</th>
              <th className="px-4 py-3">{managerMissionHeader}</th>
              <th className="px-4 py-3">Score auto-evaluation</th>
              <th className="px-4 py-3">Score manager</th>
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
                      disabled={readOnly || (row.sourceType === "assistant-rh-self-evaluation" && typeof row.managerScore !== "number")}
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
                        onClick={() => onOpenAssistantEvaluation?.(row)}
                        className="mt-2 rounded-full bg-[#0D496A] px-3 py-1 text-[11px] font-bold text-white"
                      >
                        Evaluer
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-semibold">{row.managerName}</td>
                  <td className="px-4 py-4 font-bold">{typeof row.missionScore === "number" ? row.missionScore : "--"}</td>
                  <td className="px-4 py-4 font-bold">{typeof row.managerMissionScore === "number" ? row.managerMissionScore : "--"}</td>
                  <td className="px-4 py-4 font-bold">{typeof row.selfScore === "number" ? row.selfScore : "--"}</td>
                  <td className="px-4 py-4 font-bold">{typeof row.managerScore === "number" ? row.managerScore : "--"}</td>
                  <td className="px-4 py-4 font-black text-[#78B843]">{typeof row.finalScore === "number" ? row.finalScore : "--"}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.displayStatus)}`}>{row.displayStatus}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center font-semibold text-slate-500">
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
