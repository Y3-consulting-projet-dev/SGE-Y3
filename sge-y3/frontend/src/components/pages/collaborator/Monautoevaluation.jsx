import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { saveMyAssistantEvaluation, submitMyAssistantEvaluation } from "@/lib/collaboratorEvaluation";

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - a ameliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - depasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excellent - reference dans l'equipe", color: "text-[#76B82A]" },
];

const defaultMissionCriteria = [
  { label: "Comprehension des objectifs de la mission", score: null },
  { label: "Qualite des travaux remis", score: null },
  { label: "Respect des delais convenus", score: null },
  { label: "Communication avec l'equipe mission", score: null },
];

const departmentManagers = [
  { department: "Conseil operationnel", managers: ["Revita Oule"] },
  { department: "Conseil financier", managers: ["Augustin KPANTCHE"] },
  { department: "Expertise comptable", managers: ["Stephane GNAHOUA"] },
  { department: "Audit", managers: ["Axelle AMANI", "Stephanie TAKI"] },
];

function getSourceBadgeLabel(page) {
  if (page?.source_label) return page.source_label;
  if (page?.source_sheet === "AUDIT") return "Audit";
  if (page?.source_sheet === "EXPERTISE COMPTABLE") return "Expertise comptable";
  return "";
}

function getPageProgress(page) {
  const themes = page?.themes || [];
  const answered = themes.filter((theme) => theme.score !== null && theme.score !== undefined).length;
  if (!themes.length) return 0;
  return Math.round((answered / themes.length) * 100);
}

function getCycleSectionProgress(section) {
  const pages = section?.pages || [];
  const totalThemes = pages.reduce((total, page) => total + (page.themes?.length || 0), 0);
  const answeredThemes = pages.reduce(
    (total, page) => total + (page.themes || []).filter((theme) => theme.score !== null && theme.score !== undefined).length,
    0
  );
  if (!totalThemes) return 0;
  return Math.round((answeredThemes / totalThemes) * 100);
}

function getMissionProgress(mission) {
  const criteria = mission?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function getPageAverage(page) {
  const scores = (page?.themes || []).map((theme) => theme.score).filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getMissionAverage(criteria = []) {
  const scores = criteria.map((criterion) => criterion.score).filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function createInitialPageIndexes(sections = []) {
  return Object.fromEntries(
    sections.map((section) => {
      const firstIncompletePageIndex = (section.pages || []).findIndex((page) => getPageProgress(page) < 100);
      return [section.id, firstIncompletePageIndex >= 0 ? firstIncompletePageIndex : 0];
    })
  );
}

function clampPageIndexes(sections = [], currentIndexes = {}) {
  return Object.fromEntries(
    sections.map((section) => {
      const maxIndex = Math.max((section.pages?.length || 1) - 1, 0);
      return [section.id, Math.min(currentIndexes[section.id] || 0, maxIndex)];
    })
  );
}

function CycleScoreRow({ theme, onSelect }) {
  return (
    <div className="rounded-md border border-[#E3EAF3] bg-[#F8FBFF] p-3">
      <div className="mb-3">
        <p className="text-[13px] font-bold text-[#0F3A63]">
          {theme.code}. {theme.label}
        </p>
        <p className="mt-1 text-[12px] leading-6 text-slate-600">{theme.statement}</p>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onSelect(score)}
            className={`inline-flex h-8 w-9 items-center justify-center rounded text-[12px] font-bold ${
              theme.score === score ? "bg-[#0B4C7A] text-white" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function MissionScoreRow({ label, selected, onSelect }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-[#0F3A63]">{label}</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onSelect(score)}
            className={`inline-flex h-6 w-8 items-center justify-center rounded text-[12px] font-bold ${
              selected === score ? "bg-[#0B4C7A] text-white" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function Monautoevaluation({ evaluationData, onEvaluationChange, onMissionEvaluationsChange, onSubmitted }) {
  const [step, setStep] = useState("missions");
  const [missionEvaluations, setMissionEvaluations] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [missionTitle, setMissionTitle] = useState("");
  const [missionPeriod, setMissionPeriod] = useState("");
  const [missionDepartment, setMissionDepartment] = useState(departmentManagers[0].department);
  const [sections, setSections] = useState(() => evaluationData?.evaluation?.sections || []);
  const [activeSectionId, setActiveSectionId] = useState(Number(evaluationData?.evaluation?.activeSectionId || 1));
  const [pageIndexes, setPageIndexes] = useState(() => createInitialPageIndexes(evaluationData?.evaluation?.sections || []));
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [savedComments, setSavedComments] = useState(() =>
    Object.fromEntries(
      (evaluationData?.evaluation?.sections || [])
        .flatMap((section) => section.pages || [])
        .filter((page) => page.comment?.trim())
        .map((page) => [page.page_id, page.comment.trim()])
    )
  );

  const shouldShowSourceLabel = evaluationData?.assignee?.department === "AUDIT & EXPERTISE COMPTABLE";
  const activeMission = missionEvaluations.find((mission) => Number(mission.id) === Number(activeMissionId)) || null;
  const activeSection = sections.find((section) => Number(section.id) === Number(activeSectionId)) || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const activePageSourceBadgeLabel = getSourceBadgeLabel(activePage);
  const completedSections = sections.filter((section) => section.status === "Complete").length;
  const globalProgress = Math.round(
    sections.reduce((total, section) => total + getCycleSectionProgress(section), 0) / (sections.length || 1)
  );
  const missionProgress = missionEvaluations.length
    ? Math.round(missionEvaluations.reduce((total, mission) => total + getMissionProgress(mission), 0) / missionEvaluations.length)
    : 0;
  const averageScore = useMemo(() => getPageAverage(activePage), [activePage]);
  const activeMissionAverage = useMemo(() => getMissionAverage(activeMission?.criteria), [activeMission]);
  const managerRecipients = useMemo(() => {
    const recipients = missionEvaluations.flatMap((mission) =>
      (mission.managers || []).map((manager) => ({
        department: mission.department,
        manager,
      }))
    );

    return recipients.filter(
      (recipient, index, list) =>
        recipient.manager &&
        list.findIndex((item) => item.manager === recipient.manager && item.department === recipient.department) === index
    );
  }, [missionEvaluations]);

  useEffect(() => {
    onMissionEvaluationsChange?.(missionEvaluations);
  }, [missionEvaluations, onMissionEvaluationsChange]);

  const syncSections = (updater) => {
    setSections((currentSections) => {
      const nextSections = typeof updater === "function" ? updater(currentSections) : updater;

      return nextSections.map((section) => {
        const progress = getCycleSectionProgress(section);
        return {
          ...section,
          status: progress === 0 ? "A faire" : progress === 100 ? "Complete" : "En cours",
        };
      });
    });

    setSaved(false);
    setFeedbackMessage("");
  };

  const addMission = () => {
    const title = missionTitle.trim();
    if (!title) {
      setFeedbackTone("error");
      setFeedbackMessage("Renseignez le nom de la mission.");
      return;
    }

    const nextMission = {
      id: Date.now(),
      title,
      period: missionPeriod.trim() || "Periode non renseignee",
      department: missionDepartment,
      managers: departmentManagers.find((item) => item.department === missionDepartment)?.managers || ["Manager a definir"],
      criteria: defaultMissionCriteria.map((criterion) => ({ ...criterion })),
      comment: "",
    };

    setMissionEvaluations((missions) => [...missions, nextMission]);
    setActiveMissionId(nextMission.id);
    setMissionTitle("");
    setMissionPeriod("");
    setMissionDepartment(departmentManagers[0].department);
    setFeedbackTone("success");
    setFeedbackMessage("Mission ajoutee. Vous pouvez maintenant vous evaluer dessus.");
  };

  const updateMissionScore = (criterionLabel, score) => {
    setMissionEvaluations((missions) =>
      missions.map((mission) =>
        Number(mission.id) !== Number(activeMissionId)
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) =>
                criterion.label === criterionLabel ? { ...criterion, score } : criterion
              ),
            }
      )
    );
  };

  const updateMissionComment = (comment) => {
    setMissionEvaluations((missions) =>
      missions.map((mission) => (Number(mission.id) === Number(activeMissionId) ? { ...mission, comment } : mission))
    );
  };

  const updateScore = (themeId, score) => {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(activeSectionId)) return section;

        return {
          ...section,
          pages: (section.pages || []).map((page, pageIndex) =>
            pageIndex !== activePageIndex
              ? page
              : {
                  ...page,
                  themes: (page.themes || []).map((theme) =>
                    theme.theme_id === themeId ? { ...theme, score } : theme
                  ),
                }
          ),
        };
      })
    );
  };

  const updateComment = (comment) => {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(activeSectionId)) return section;

        return {
          ...section,
          pages: (section.pages || []).map((page, pageIndex) =>
            pageIndex !== activePageIndex ? page : { ...page, comment }
          ),
        };
      })
    );
  };

  const persistSections = async (nextSections = sections) => {
    setIsSaving(true);

    try {
      const response = await saveMyAssistantEvaluation(nextSections);
      setSections(response.evaluation.sections);
      setPageIndexes((current) => clampPageIndexes(response.evaluation.sections, current));
      setSaved(true);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Sauvegarde reussie.");

      const currentSection = response.evaluation.sections.find((section) => Number(section.id) === Number(activeSectionId));
      const currentPage = currentSection?.pages?.[activePageIndex];
      if (currentPage?.comment?.trim()) {
        setSavedComments((comments) => ({ ...comments, [currentPage.page_id]: currentPage.comment.trim() }));
      }

      onEvaluationChange?.(response);
      return response;
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Sauvegarde impossible.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const goToStep = (direction) => {
    const sectionIndex = sections.findIndex((section) => Number(section.id) === Number(activeSectionId));
    const pages = activeSection?.pages || [];
    const nextPageIndex = activePageIndex + direction;

    if (nextPageIndex >= 0 && nextPageIndex < pages.length) {
      setPageIndexes((current) => ({ ...current, [activeSectionId]: nextPageIndex }));
      setSaved(false);
      setFeedbackMessage("");
      return;
    }

    const nextSection = sections[sectionIndex + direction];
    if (!nextSection) return;

    setActiveSectionId(Number(nextSection.id));
    setPageIndexes((current) => ({
      ...current,
      [nextSection.id]: direction > 0 ? 0 : Math.max((nextSection.pages?.length || 1) - 1, 0),
    }));
    setSaved(false);
    setFeedbackMessage("");
  };

  const handleSaveAndContinue = async () => {
    const response = await persistSections(sections);
    if (response) goToStep(1);
  };

  const handleSubmit = async () => {
    if (!managerRecipients.length) {
      setStep("missions");
      setFeedbackTone("error");
      setFeedbackMessage("Ajoutez au moins une mission avec son departement avant de soumettre aux managers.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistSections(sections);
      if (!savedResponse) return;

      const submittedResponse = await submitMyAssistantEvaluation({
        managerRecipients,
        missionEvaluations,
      });
      setSections(submittedResponse.evaluation.sections);
      setPageIndexes(createInitialPageIndexes(submittedResponse.evaluation.sections));
      setFeedbackTone("success");
      setFeedbackMessage(submittedResponse.message || "Auto-evaluation soumise aux managers.");
      onEvaluationChange?.(submittedResponse);
      onSubmitted?.(submittedResponse);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");

      const firstMissingSection = error?.details?.missingAnswers?.[0]?.sectionId;
      const firstMissingPageTitle = error?.details?.missingAnswers?.[0]?.pageTitle;

      if (firstMissingSection) {
        setStep("cycle");
        setActiveSectionId(Number(firstMissingSection));
        const nextSection = sections.find((section) => Number(section.id) === Number(firstMissingSection));
        const missingPageIndex = (nextSection?.pages || []).findIndex((page) => page.title === firstMissingPageTitle);
        if (missingPageIndex >= 0) {
          setPageIndexes((current) => ({ ...current, [firstMissingSection]: missingPageIndex }));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeSection || !activePage) {
    return (
      <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement de l'auto-evaluation...
      </div>
    );
  }

  const isLastStep =
    sections.findIndex((section) => Number(section.id) === Number(activeSectionId)) === sections.length - 1 &&
    activePageIndex === (activeSection.pages?.length || 1) - 1;

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-slate-500">
        {evaluationData?.assignee?.current_cycle || "Cycle 2026"} - Auto-evaluation en deux etapes - Sauvegarde progressive activee
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setStep("missions")}
          className={`rounded-lg p-4 text-left transition ${
            step === "missions" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"
          }`}
        >
          <p className="text-xs font-bold uppercase opacity-80">Etape 1</p>
          <h2 className="mt-1 text-lg font-black">Evaluation par mission</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">Missions ajoutees par le collaborateur - {missionProgress}%</p>
        </button>
        <button
          type="button"
          onClick={() => setStep("cycle")}
          className={`rounded-lg p-4 text-left transition ${
            step === "cycle" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"
          }`}
        >
          <p className="text-xs font-bold uppercase opacity-80">Etape 2</p>
          <h2 className="mt-1 text-lg font-black">Evaluation globale du cycle</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">
            {evaluationData?.assignee?.current_cycle || "Cycle 2026"} - {globalProgress}%
          </p>
        </button>
      </section>

      {step === "missions" ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr]">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="text-lg font-bold text-[#0F3A63]">Mes missions de l'annee</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Le collaborateur renseigne ici les missions qu'il a reellement effectuees.
            </p>

            <div className="mt-4 rounded-lg bg-[#F8FAFC] p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Ajouter une mission</p>
              <input
                value={missionTitle}
                onChange={(event) => setMissionTitle(event.target.value)}
                placeholder="Nom ou type de mission"
                className="mt-3 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
              />
              <input
                value={missionPeriod}
                onChange={(event) => setMissionPeriod(event.target.value)}
                placeholder="Periode de la mission"
                className="mt-2 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
              />
              <select
                value={missionDepartment}
                onChange={(event) => setMissionDepartment(event.target.value)}
                className="mt-2 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
              >
                {departmentManagers.map((item) => (
                  <option key={item.department} value={item.department}>
                    {item.department} - Manager(s) : {item.managers.join(", ")}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addMission}
                className="mt-3 rounded-md bg-[#76B82A] px-4 py-2 text-xs font-bold text-white"
              >
                Ajouter la mission
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {missionEvaluations.length ? (
                missionEvaluations.map((mission) => {
                  const progress = getMissionProgress(mission);
                  const isActive = Number(activeMissionId) === Number(mission.id);

                  return (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => setActiveMissionId(mission.id)}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        isActive ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{mission.period}</p>
                      <p className="mt-1 text-xs font-bold text-[#0F4A72]">
                        {mission.department} - {mission.managers.join(", ")}
                      </p>
                      <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                        <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#76B82A]">{progress}% complete</p>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-md bg-[#EEF2F6] px-3 py-3 text-sm font-semibold text-slate-500">
                  Aucune mission ajoutee pour le moment.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            {activeMission ? (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black leading-tight text-[#0F3A63]">{activeMission.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{activeMission.period}</p>
                    <p className="mt-1 text-sm font-bold text-[#0F4A72]">
                      Departement : {activeMission.department} - Destinataire(s) : {activeMission.managers.join(", ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                    Moyenne {activeMissionAverage} / 5
                  </span>
                </div>

                <div className="space-y-3.5">
                  {activeMission.criteria.map((item) => (
                    <MissionScoreRow
                      key={item.label}
                      label={item.label}
                      selected={item.score}
                      onSelect={(score) => updateMissionScore(item.label, score)}
                    />
                  ))}
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire sur la mission</p>
                  <textarea
                    rows={4}
                    value={activeMission.comment}
                    onChange={(event) => updateMissionComment(event.target.value)}
                    placeholder="Decrire les faits marquants, difficultes, resultats obtenus..."
                    className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                  />
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep("cycle")}
                    className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                  >
                    Continuer vers l'evaluation globale
                    <ChevronRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-[#EEF2F6] p-5 text-sm font-semibold text-slate-500">
                Ajoutez une mission pour commencer votre auto-evaluation par mission.
              </div>
            )}
          </article>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
            <p className="font-semibold text-[#0F3A63]">
              Derniere sauvegarde : {evaluationData?.evaluation?.last_saved_at ? "enregistree" : "non disponible"}
            </p>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-[#0F3A63]">
                Section {sections.findIndex((section) => Number(section.id) === Number(activeSectionId)) + 1} / {sections.length}
              </span>
              <span className="font-semibold text-slate-500">
                Titre {activePageIndex + 1} / {activeSection.pages?.length || 1}
              </span>
              <button type="button" onClick={() => persistSections(sections)} className="font-semibold text-[#76B82A] hover:underline">
                {isSaving ? "Sauvegarde..." : "Sauvegarder maintenant"}
              </button>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {sections.map((section) => {
              const progress = getCycleSectionProgress(section);
              const done = section.status === "Complete";

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSectionId(Number(section.id));
                    setSaved(false);
                    setFeedbackMessage("");
                  }}
                  className={`rounded-md border px-3 py-3 text-left text-white transition focus:outline-none ${
                    Number(activeSectionId) === Number(section.id)
                      ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]"
                      : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[13px] font-bold">{section.title}</h2>
                    {done ? <Check size={14} className="text-white" /> : null}
                  </div>
                  <p className="text-[12px] font-semibold">{section.pages?.length || 0} titre(s)</p>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                    <div className={`h-1.5 rounded-full ${done ? "bg-[#7BC443]" : "bg-[#D6DCE2]"}`} style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] font-semibold text-slate-200">
                    {done ? "Complete" : progress ? `En cours - ${progress}%` : "A faire"}
                  </p>
                </button>
              );
            })}
          </section>

          <section className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Pagination dans la section</p>
                <h3 className="text-[18px] font-bold text-[#0F3A63]">{activeSection.title}</h3>
              </div>
              <span className="text-[12px] font-semibold text-[#0F3A63]">
                Titre {activePageIndex + 1} / {activeSection.pages?.length || 1}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(activeSection.pages || []).map((page, index) => {
                const isActive = index === activePageIndex;
                const progress = getPageProgress(page);
                const sourceBadgeLabel = getSourceBadgeLabel(page);

                return (
                  <button
                    key={page.page_id}
                    type="button"
                    onClick={() =>
                      setPageIndexes((current) => ({
                        ...current,
                        [activeSection.id]: index,
                      }))
                    }
                    className={`rounded-md border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]"
                        : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-[11px] font-bold">Titre {index + 1}</p>
                    <p className="mt-1 text-[12px] font-semibold">{page.title}</p>
                    {shouldShowSourceLabel && sourceBadgeLabel && page.source_sheet !== "TRONC COMMUN" ? (
                      <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                        {sourceBadgeLabel}
                      </span>
                    ) : null}
                    <p className="mt-1 text-[10px] font-semibold text-[#76B82A]">{progress}%</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
            <article className="rounded-md bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[28px] font-bold leading-none text-[#0F3A63]">{activeSection.title}</h3>
                  <p className="mt-2 text-[18px] font-semibold text-[#0F3A63]">{activePage.title}</p>
                  {shouldShowSourceLabel && activePageSourceBadgeLabel && activePage.source_sheet !== "TRONC COMMUN" ? (
                    <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[11px] font-semibold text-[#0F3A63]">
                      {activePageSourceBadgeLabel}
                    </span>
                  ) : null}
                  <p className="mt-2 text-[12px] font-semibold text-slate-500">Score moyen : {averageScore} / 5</p>
                </div>
                <span className="text-[16px] font-bold text-[#32B3E0]">{activeSection.status}</span>
              </div>

              <div className="space-y-3.5">
                {(activePage.themes || []).map((theme) => (
                  <CycleScoreRow key={theme.theme_id} theme={theme} onSelect={(score) => updateScore(theme.theme_id, score)} />
                ))}
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire du titre (facultatif)</p>
                <textarea
                  rows={4}
                  value={activePage.comment || ""}
                  onChange={(event) => updateComment(event.target.value)}
                  placeholder="Points forts, exemples concrets, contexte..."
                  className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                />
              </div>

              {savedComments[activePage.page_id] ? (
                <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2">
                  <p className="text-[10px] font-bold text-[#5A8A3A]">Commentaire sauvegarde</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#0F3A63]">{savedComments[activePage.page_id]}</p>
                </div>
              ) : null}

              <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
                Les questions obligatoires sans reponse bloqueront la soumission aux managers concernes.
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(-1)}
                  disabled={Number(activeSectionId) === Number(sections[0]?.id) && activePageIndex === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  Precedent
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  {!isLastStep ? (
                    <button
                      type="button"
                      onClick={handleSaveAndContinue}
                      disabled={isSaving || isSubmitting}
                      className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      Sauvegarder et continuer
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={
                        isSaving ||
                        isSubmitting ||
                        evaluationData?.evaluation?.status === "Soumis aux Managers" ||
                        evaluationData?.evaluation?.status === "Soumis a RH"
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      {isSubmitting ? "Soumission..." : "Soumettre aux managers"}
                    </button>
                  )}
                </div>
              </div>

              {feedbackMessage ? (
                <p className={`mt-2 text-right text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
                  {feedbackMessage}
                </p>
              ) : saved ? (
                <p className="mt-2 text-right text-[11px] font-semibold text-[#76B82A]">Sauvegarde reussie.</p>
              ) : null}
            </article>

            <div className="space-y-4">
              <article className="rounded-md bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-[18px] font-bold text-[#0F3A63]">Managers destinataires</h3>
                {managerRecipients.length ? (
                  <div className="space-y-2">
                    {managerRecipients.map((recipient) => (
                      <div key={`${recipient.department}-${recipient.manager}`} className="rounded-md bg-[#F8FAFC] px-3 py-2">
                        <p className="text-xs font-bold text-[#0F3A63]">{recipient.manager}</p>
                        <p className="text-[11px] font-semibold text-slate-500">{recipient.department}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-500">
                    Ajoutez vos missions pour determiner les managers destinataires.
                  </p>
                )}
              </article>

              <article className="rounded-md bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[22px] font-bold text-[#0F3A63]">Progression globale</h3>
                  <span className="text-[13px] font-bold text-[#76B82A]">{globalProgress}%</span>
                </div>
                <p className="mb-4 text-[12px] font-semibold text-[#76B82A]">{completedSections} section(s) complete(s)</p>

                <div className="space-y-3">
                  {sections.map((section) => (
                    <div key={section.id} className="flex items-center justify-between text-[12px]">
                      <p className="font-semibold text-[#0F3A63]">{section.title}</p>
                      <span className="font-bold text-[#76B82A]">{getCycleSectionProgress(section)}%</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-md bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Aide a la notation</h3>
                <div className="space-y-2">
                  {gradingHelp.map((item) => (
                    <div key={item.level} className="flex items-center gap-2 text-[12px]">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 font-bold text-slate-500">
                        {item.level}
                      </span>
                      <p className={`font-semibold ${item.color}`}>{item.text}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Monautoevaluation;
