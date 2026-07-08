import { useEffect, useMemo, useRef, useState } from "react";
import { getRhDepartmentEvaluationDetail, getRhDepartmentEvaluations, selectRhDepartmentEvaluation } from "@/api/rhOverview";

function statusClass(status) {
  if (status === "Valide" || status === "Pret Associe" || status === "Prêt Associé") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "Ecart a arbitrer" || status === "Ecart à arbitrer") return "bg-[#F9DFDF] text-[#B63232]";
  if (status === "A completer" || status === "À compléter") return "bg-[#FFF2CC] text-[#8A6810]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function formatScore(score) {
  return typeof score === "number" ? `${score.toFixed(1)}/5` : "--";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function getDisplayFinalScore(member = {}) {
  return member.rhValidationFinalScore ?? member.finalScore;
}

function groupDetailsByMission(details = []) {
  const missionMap = new Map();

  details.forEach((detail, index) => {
    const missionTitle = detail.missionTitle || "Évaluation globale";
    const missionKey = detail.missionId || missionTitle;
    const current = missionMap.get(missionKey) || {
      title: missionTitle,
      finalScore: null,
      evaluators: [],
    };
    const isFinalScore = String(detail.source || "").toLowerCase().includes("score final");

    if (isFinalScore) {
      current.finalScore = detail.score;
    } else {
      current.evaluators.push({ ...detail, key: `${missionKey}-${detail.source}-${detail.evaluatorName}-${index}` });
    }

    missionMap.set(missionKey, current);
  });

  return Array.from(missionMap.values());
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
    <div
      ref={containerRef}
      className="group relative inline-flex"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setIsPinned((current) => !current)}
        className="cursor-help font-bold text-[#0F3A63] underline decoration-dotted underline-offset-4"
      >
        {score.toFixed(1)}
      </button>
      {details.length ? (
        <div
          className={`absolute left-0 top-full z-20 mt-2 w-[320px] rounded-md bg-[#0F3A63] p-4 text-xs text-white shadow-xl transition-opacity duration-150 ${
            isPinned
              ? "pointer-events-auto visible opacity-100"
              : "pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100"
          }`}
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
                <p className="mt-1 font-bold text-[#A7F3D0]">{typeof detail.score === "number" ? `${detail.score.toFixed(1)}/5` : "--"}</p>
                {detail.submittedAt ? <p className="text-[11px] text-slate-300">{formatDate(detail.submittedAt)}</p> : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-semibold text-slate-300">Cliquez à l’extérieur ou sur `Echap` pour fermer.</p>
        </div>
      ) : null}
    </div>
  );
}

function EvaluationStepCard({ step }) {
  return (
    <section className="rounded-lg bg-[#F8FAFC] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-[#0F3A63]">{step.source}</h4>
          <p className="text-xs font-semibold text-slate-500">
            {step.evaluatorName} - {step.evaluatorGrade}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-[#0F3A63]">{formatScore(step.overallScore)}</p>
          {step.submittedAt ? <p className="text-xs font-semibold text-slate-400">{formatDate(step.submittedAt)}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h5 className="text-xs font-extrabold uppercase text-slate-500">Notes par section</h5>
          {step.sectionScores.length ? (
            step.sectionScores.map((section) => (
              <div key={`${step.source}-${section.sectionId}-${section.title}`}>
                <div className="mb-1 flex items-center justify-between text-xs font-bold text-[#0F4A72]">
                  <span>{section.title}</span>
                  <span>{formatScore(section.score)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-[#4E75C7]" style={{ width: `${Number(section.score) * 20}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-slate-500">Aucune note de section disponible.</p>
          )}
        </div>

        <div className="space-y-3">
          <h5 className="text-xs font-extrabold uppercase text-slate-500">Commentaires de section</h5>
          {step.sectionComments.length ? (
            step.sectionComments.map((section) => (
              <div key={`${step.source}-${section.sectionId}-${section.title}`} className="rounded-md bg-white px-3 py-3">
                <p className="text-xs font-extrabold uppercase text-[#0F4A72]">{section.title}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{section.comment}</p>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-slate-500">Aucun commentaire de section disponible.</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <h5 className="text-xs font-extrabold uppercase text-slate-500">Justifications par titre</h5>
        {step.titleJustifications?.length ? (
          step.titleJustifications.map((title) => (
            <div key={`${step.source}-${title.pageId}-${title.pageTitle}`} className="rounded-md bg-white px-3 py-3">
              <p className="text-xs font-extrabold uppercase text-[#0F4A72]">{title.sectionTitle}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{title.pageTitle}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{title.comment}</p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-slate-500">Aucune justification de titre disponible.</p>
        )}
      </div>
    </section>
  );
}

function MissionEvaluationDetails({ details = [] }) {
  const missionGroups = groupDetailsByMission(details);

  if (!missionGroups.length) {
    return <p className="text-sm font-semibold text-slate-500">Aucun détail de mission disponible pour ce collaborateur.</p>;
  }

  return (
    <div className="space-y-4">
      {missionGroups.map((mission, missionIndex) => (
        <section key={`${mission.title}-${missionIndex}`} className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h5 className="text-base font-black text-[#0F3A63]">{mission.title}</h5>
              <p className="mt-1 text-xs font-bold uppercase text-slate-400">
                {mission.evaluators.length} évaluateur(s)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase text-slate-400">Note finale de mission</p>
              <p className="mt-1 text-lg font-black text-[#78B843]">{formatScore(mission.finalScore)}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {mission.evaluators.map((detail) => (
              <article key={detail.key} className="rounded-lg bg-[#F8FAFC] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#0F3A63]">
                      {detail.source} - {detail.evaluatorName}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{detail.evaluatorGrade || "Collaborateur"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#78B843]">{formatScore(detail.score)}</p>
                    {detail.submittedAt ? <p className="mt-1 text-xs font-semibold text-slate-400">{formatDate(detail.submittedAt)}</p> : null}
                  </div>
                </div>

                {detail.sectionComments?.length ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {detail.sectionComments.map((section) => (
                      <div key={`${detail.key}-${section.sectionId || section.title}`} className="rounded-md bg-white px-3 py-3">
                        <p className="text-xs font-extrabold uppercase text-[#0F4A72]">{section.title}</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{section.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {detail.titleJustifications?.length ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Justifications par titre</p>
                    {detail.titleJustifications.map((title) => (
                      <div key={`${detail.key}-${title.pageId}-${title.pageTitle}`} className="rounded-md bg-white px-3 py-3">
                        <p className="text-xs font-extrabold uppercase text-[#0F4A72]">{title.sectionTitle}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{title.pageTitle}</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{title.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EvaluationsDepartementRH() {
  const [data, setData] = useState(null);
  const [activeDepartment, setActiveDepartment] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setErrorMessage("");
    const response = await getRhDepartmentEvaluations();
    setData(response);
    setActiveDepartment((current) => current || response.departments?.[0]?.department || "");
    setSelectedMember(null);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const response = await getRhDepartmentEvaluations();
        if (cancelled) return;
        setData(response);
        setActiveDepartment(response.departments?.[0]?.department || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des évaluations par département impossible.");
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

  const departmentGroups = data?.departments || [];
  const selectedDepartment = useMemo(
    () => departmentGroups.find((group) => group.department === activeDepartment) || departmentGroups[0],
    [departmentGroups, activeDepartment]
  );

  async function handleSelectForValidation() {
    if (!selectedMember?.id) return;

    try {
      setIsSelecting(true);
      setFeedbackMessage("");
      const response = await selectRhDepartmentEvaluation(selectedMember.id);
      setFeedbackMessage(response.message || "Évaluation ajoutée à la validation RH.");
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "Sélection RH impossible.");
    } finally {
      setIsSelecting(false);
    }
  }

  async function handleOpenMember(member) {
    setSelectedMember(member);

    if (!member?.id || String(member.id).startsWith("pending-")) {
      return;
    }

    try {
      setIsLoadingDetail(true);
      const detail = await getRhDepartmentEvaluationDetail(member.id);
      setSelectedMember(detail);
    } catch (error) {
      setErrorMessage(error.message || "Chargement du detail RH impossible.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des évaluations</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!selectedDepartment) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucune évaluation transmise à la RH pour le moment.</section>;
  }

  return (
    <section className="space-y-5">
      {feedbackMessage ? (
        <div className="rounded-md bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">{feedbackMessage}</div>
      ) : null}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#0F3A63]">Évaluations des équipes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Vue RH des scores missions, globaux et finaux par département.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {departmentGroups.map((group) => (
              <button
                key={group.department}
                type="button"
                onClick={() => {
                  setActiveDepartment(group.department);
                  setSelectedMember(null);
                }}
                className={`rounded-full px-4 py-2 text-xs font-bold ${
                  activeDepartment === group.department ? "bg-[#0D496A] text-white" : "bg-[#E7EDF3] text-[#0F3A63]"
                }`}
              >
                {group.department}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-[#0D496A] p-4 text-white">
          <p className="text-sm font-semibold">Département</p>
          <p className="mt-2 text-2xl font-black leading-none">{selectedDepartment.department}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Évaluations visibles</p>
          <p className="mt-2 text-2xl font-black leading-none text-[#0F3A63]">{selectedDepartment.members.length}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Moyenne du département</p>
          <p className="mt-2 text-2xl font-black leading-none text-[#78B843]">
            {typeof selectedDepartment.average === "number" ? `${selectedDepartment.average}/5` : "--"}
          </p>
        </article>
      </div>

      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[#0F3A63]">Département {selectedDepartment.department}</h3>
            <p className="text-sm font-semibold text-slate-500">
              Responsable d'équipe : {selectedDepartment.manager || "Manager"} - Manager du département : {selectedDepartment.manager || "Manager"}
            </p>
          </div>
          <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-bold text-[#0F4A72]">
            {selectedDepartment.members.length} évaluation(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#F3F6F8] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Evaluateur</th>
                <th className="px-4 py-3">Score final</th>
                <th className="px-4 py-3">Statut RH</th>
              </tr>
            </thead>
            <tbody>
              {selectedDepartment.members.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => handleOpenMember(member)}
                  className={`cursor-pointer border-b border-slate-100 text-[#0F3A63] last:border-0 hover:bg-[#F8FAFC] ${
                    selectedMember?.id === member.id ? "bg-[#EEF6E8]" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <p className="font-bold">{member.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{member.role}</p>
                  </td>
                  <td className="px-4 py-4 font-semibold">{member.evaluator}</td>
                  <td className="px-4 py-4">
                    <ScoreWithTooltip score={getDisplayFinalScore(member)} details={member.missionScoreDetails} />
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(member.status)}`}>
                      {member.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {selectedMember ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E2B4F]/45 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evaluation-detail-title"
          onClick={() => setSelectedMember(null)}
        >
          <article
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Détail de l'évaluation</p>
                <h3 id="evaluation-detail-title" className="mt-1 text-2xl font-black text-[#0F3A63]">
                  {selectedMember.name}
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  {selectedMember.role} - {selectedDepartment.department}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={selectedMember.rhValidationSelected || selectedMember.status === "Valide" || selectedMember.status === "Pret Associe" || !selectedMember.id || selectedMember.id.startsWith("pending-") || isSelecting}
                  onClick={handleSelectForValidation}
                  className="rounded-full bg-[#E7EDF3] px-4 py-2 text-xs font-bold text-[#0F4A72] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectedMember.rhValidationSelected ? "À valider RH" : "Valider"}
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-[#0F3A63] hover:bg-slate-200"
                  aria-label="Fermer le détail de l'évaluation"
                >
                  x
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Score final</p>
                <p className="mt-2 text-2xl font-black text-[#78B843]">{formatScore(getDisplayFinalScore(selectedMember))}</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Nombre total de missions</p>
                <p className="mt-2 text-2xl font-black text-[#0F3A63]">
                  {selectedMember.missionScoreCount || groupDetailsByMission(selectedMember.missionScoreDetails || []).length || 0}
                </p>
              </div>
            </div>

            

            <section className="mt-5 rounded-lg bg-[#F8FAFC] p-4">
              <h4 className="text-sm font-extrabold text-[#0F3A63]">Détail complet de l'évaluation</h4>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Toutes les missions, les évaluateurs, les notes, les commentaires et les justifications.
              </p>
              <div className="mt-4 space-y-4">
                {isLoadingDetail ? (
                  <p className="text-sm font-semibold text-slate-500">Chargement du detail de l'evaluation...</p>
                ) : (selectedMember.missionScoreDetails || []).length ? (
                  <MissionEvaluationDetails details={selectedMember.missionScoreDetails || []} />
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Aucun détail d'évaluation disponible pour ce collaborateur.</p>
                )}
              </div>
            </section>
          </article>
        </div>
      ) : null}
    </section>
  );
}

export default EvaluationsDepartementRH;
