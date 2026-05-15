import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getMySeniorEvaluation,
  saveMySeniorEvaluation,
  submitMySeniorEvaluation,
  submitMySeniorMissionEvaluation,
} from "@/lib/seniorEvaluation";
import { getDisplayName } from "@/lib/userPresentation";

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - a ameliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - depasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excellent - reference dans l'equipe", color: "text-[#76B82A]" },
];

function getRecipientLabel(recipient) {
  if (!recipient?.name) return "";
  if (!recipient?.grade) return recipient.name;
  return `${recipient.name} (${recipient.grade})`;
}

function getRecipientOptionValue(recipient) {
  return `${recipient.department}::${recipient.id}`;
}

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

function normalizeDepartment(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toUpperCase();
}

function shouldShowMissionGroupForRecipient(group, recipientDepartment) {
  const normalizedRecipientDepartment = normalizeDepartment(recipientDepartment);
  const normalizedSourceSheet = normalizeDepartment(group?.sourceSheet);

  if (!normalizedRecipientDepartment || !normalizedSourceSheet || normalizedSourceSheet === "TRONC COMMUN") {
    return true;
  }

  if (normalizedRecipientDepartment === "AUDIT") {
    return normalizedSourceSheet === "AUDIT";
  }

  if (normalizedRecipientDepartment === "EXPERTISE COMPTABLE") {
    return normalizedSourceSheet === "EXPERTISE COMPTABLE";
  }

  if (normalizedRecipientDepartment === "AUDIT & EXPERTISE COMPTABLE") {
    return normalizedSourceSheet === "AUDIT" || normalizedSourceSheet === "EXPERTISE COMPTABLE";
  }

  return true;
}

function buildMissionCriteriaFromSections(sections = [], recipientDepartment = "") {
  return sections.flatMap((section) =>
    (section.pages || []).flatMap((page) =>
      shouldShowMissionGroupForRecipient({ sourceSheet: page.source_sheet || "" }, recipientDepartment)
        ? (page.themes || []).map((theme) => ({
            id: `${page.page_id}-${theme.theme_id}`,
            sectionTitle: section.title,
            pageTitle: page.title,
            sourceSheet: page.source_sheet || "",
            sourceLabel: page.source_label || "",
            themeCode: theme.code,
            label: theme.label,
            statement: theme.statement,
            score: null,
          }))
        : []
    )
  );
}

function getMissionCriteriaGroups(criteria = []) {
  const groups = [];

  for (const criterion of criteria) {
    const key = `${criterion.sectionTitle}::${criterion.pageTitle}::${criterion.sourceSheet || ""}::${criterion.sourceLabel || ""}`;
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.criteria.push(criterion);
      continue;
    }

    groups.push({
      key,
      sectionTitle: criterion.sectionTitle,
      pageTitle: criterion.pageTitle,
      sourceSheet: criterion.sourceSheet,
      sourceLabel: criterion.sourceLabel,
      criteria: [criterion],
    });
  }

  return groups;
}

function getMissionGroupProgress(group) {
  const criteria = group?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function sanitizeMissionEvaluation(mission) {
  if (!mission) return mission;

  const recipientDepartment = mission.recipients?.[0]?.department || mission.department || "";
  return {
    ...mission,
    criteria: (mission.criteria || []).filter((criterion) =>
      shouldShowMissionGroupForRecipient(
        {
          sourceSheet: criterion.sourceSheet || criterion.source_sheet || "",
        },
        recipientDepartment
      )
    ),
  };
}

function sanitizeMissionEvaluations(missions = []) {
  return missions.map(sanitizeMissionEvaluation);
}

function getMissionSections(groups = []) {
  const sections = [];

  for (const group of groups) {
    const existingSection = sections.find((section) => section.title === group.sectionTitle);

    if (existingSection) {
      existingSection.groups.push(group);
      continue;
    }

    sections.push({
      id: group.sectionTitle,
      title: group.sectionTitle,
      groups: [group],
    });
  }

  return sections;
}

function getMissionSectionProgress(section) {
  const criteria = (section?.groups || []).flatMap((group) => group.criteria || []);
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
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

function MissionScoreRow({ themeCode, label, statement, selected, onSelect }) {
  return (
    <div className="rounded-md border border-[#E3EAF3] bg-[#F8FBFF] p-3">
      <p className="text-[12px] font-semibold text-[#0F3A63]">
        {themeCode ? `${themeCode}. ` : ""}
        {label}
      </p>
      {statement ? <p className="mt-1 text-[11px] leading-5 text-slate-600">{statement}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onSelect(score)}
            className={`inline-flex h-8 w-9 items-center justify-center rounded text-[12px] font-bold ${
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

function MonautoevaluationSenior({ user }) {
  const [evaluationData, setEvaluationData] = useState(null);
  const [step, setStep] = useState("missions");
  const [sections, setSections] = useState([]);
  const [missionEvaluations, setMissionEvaluations] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(1);
  const [pageIndexes, setPageIndexes] = useState({});
  const [activeMissionId, setActiveMissionId] = useState("");
  const [missionSectionIds, setMissionSectionIds] = useState({});
  const [missionPageIndexes, setMissionPageIndexes] = useState({});
  const [missionTitle, setMissionTitle] = useState("");
  const [missionPeriod, setMissionPeriod] = useState("");
  const [selectedRecipientValue, setSelectedRecipientValue] = useState("");
  const [savedComments, setSavedComments] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getMySeniorEvaluation();

        if (cancelled) return;

        setEvaluationData(response);
        setSections(response.evaluation.sections || []);
        setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
        setActiveMissionId(response.mission_evaluations?.[0]?.id || "");
        setActiveSectionId(Number(response.evaluation.activeSectionId || response.evaluation.sections?.[0]?.id || 1));
        setPageIndexes(createInitialPageIndexes(response.evaluation.sections || []));
        setSavedComments(
          Object.fromEntries(
            (response.evaluation.sections || [])
              .flatMap((section) => section.pages || [])
              .filter((page) => page.comment?.trim())
              .map((page) => [page.page_id, page.comment.trim()])
          )
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de l'auto-evaluation impossible.");
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
  }, []);

  const departmentRecipients = evaluationData?.assignee?.recipient_options || [];
  const recipientOptions = departmentRecipients.flatMap((item) =>
    (item.users || []).map((recipient) => ({
      ...recipient,
      department: item.department,
    }))
  );
  const initialRecipientValue = recipientOptions[0] ? getRecipientOptionValue(recipientOptions[0]) : "";
  const effectiveRecipientValue =
    selectedRecipientValue && recipientOptions.some((recipient) => getRecipientOptionValue(recipient) === selectedRecipientValue)
      ? selectedRecipientValue
      : initialRecipientValue;

  const selectedRecipient = useMemo(
    () => recipientOptions.find((recipient) => getRecipientOptionValue(recipient) === effectiveRecipientValue) || null,
    [effectiveRecipientValue, recipientOptions]
  );

  const activeSection = sections.find((section) => Number(section.id) === Number(activeSectionId)) || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const shouldShowSourceLabel = evaluationData?.assignee?.department === "AUDIT & EXPERTISE COMPTABLE";
  const activePageSourceBadgeLabel = getSourceBadgeLabel(activePage);
  const completedSections = sections.filter((section) => section.status === "Complete").length;
  const globalProgress = Math.round(
    sections.reduce((total, section) => total + getCycleSectionProgress(section), 0) / (sections.length || 1)
  );
  const averageScore = useMemo(() => getPageAverage(activePage), [activePage]);
  const displayName = getDisplayName(user || evaluationData?.assignee || {});

  const activeMission = missionEvaluations.find((mission) => mission.id === activeMissionId) || missionEvaluations[0] || null;
  const missionCriteriaGroups = useMemo(() => getMissionCriteriaGroups(activeMission?.criteria || []), [activeMission]);
  const filteredMissionCriteriaGroups = useMemo(() => {
    const recipientDepartment = activeMission?.recipients?.[0]?.department || "";
    return missionCriteriaGroups.filter((group) => shouldShowMissionGroupForRecipient(group, recipientDepartment));
  }, [activeMission, missionCriteriaGroups]);
  const missionSections = useMemo(() => getMissionSections(filteredMissionCriteriaGroups), [filteredMissionCriteriaGroups]);
  const activeMissionSectionId = missionSectionIds[activeMissionId] || missionSections[0]?.id || "";
  const activeMissionSection = missionSections.find((section) => section.id === activeMissionSectionId) || missionSections[0] || null;
  const activeMissionSectionIndex = missionSections.findIndex((section) => section.id === activeMissionSection?.id);
  const activeMissionPageIndex = Math.min(
    missionPageIndexes[activeMissionId] || 0,
    Math.max((activeMissionSection?.groups?.length || 1) - 1, 0)
  );
  const activeMissionGroup = activeMissionSection?.groups?.[activeMissionPageIndex] || activeMissionSection?.groups?.[0] || null;
  const activeMissionAverage = getMissionAverage(activeMissionGroup?.criteria || []);
  const activeMissionSourceBadgeLabel = getSourceBadgeLabel({
    source_label: activeMissionGroup?.sourceLabel,
    source_sheet: activeMissionGroup?.sourceSheet,
  });

  function syncSections(updater) {
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

    setFeedbackMessage("");
  }

  function updateScore(themeId, score) {
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
                  themes: (page.themes || []).map((theme) => (theme.theme_id === themeId ? { ...theme, score } : theme)),
                }
          ),
        };
      })
    );
  }

  function updateMissionScore(criterionId, score) {
    setMissionEvaluations((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== activeMissionId
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) =>
                criterion.id === criterionId ? { ...criterion, score } : criterion
              ),
            }
      )
    );
    setFeedbackMessage("");
  }

  function updateComment(comment) {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(activeSectionId)) return section;

        return {
          ...section,
          pages: (section.pages || []).map((page, pageIndex) => (pageIndex !== activePageIndex ? page : { ...page, comment })),
        };
      })
    );
  }

  function handleAddMission() {
    const title = missionTitle.trim();

    if (!title) {
      setFeedbackTone("error");
      setFeedbackMessage("Renseignez le nom de la mission.");
      return;
    }

    if (!selectedRecipient) {
      setFeedbackTone("error");
      setFeedbackMessage("Selectionnez un manager destinataire pour cette mission.");
      return;
    }

    const nextMission = {
      id: `${Date.now()}`,
      title,
      period: missionPeriod.trim() || "Periode non renseignee",
      department: selectedRecipient.department,
      recipients: [
        {
          id: selectedRecipient.id,
          name: selectedRecipient.name,
          grade: selectedRecipient.grade,
          department: selectedRecipient.department,
        },
      ],
      criteria: buildMissionCriteriaFromSections(sections, selectedRecipient.department),
      comment: "",
      status: "Brouillon",
    };

    setMissionEvaluations((missions) => [...missions, nextMission]);
    setActiveMissionId(nextMission.id);
    setMissionSectionIds((current) => ({
      ...current,
      [nextMission.id]: nextMission.criteria[0]?.sectionTitle || "",
    }));
    setMissionPageIndexes((current) => ({ ...current, [nextMission.id]: 0 }));
    setMissionTitle("");
    setMissionPeriod("");
    setFeedbackTone("success");
    setFeedbackMessage("Mission ajoutee. Vous pouvez maintenant la noter.");
  }

  async function persistEvaluation(nextSections = sections, nextMissionEvaluations = missionEvaluations) {
    setIsSaving(true);

    try {
      const response = await saveMySeniorEvaluation({
        sections: nextSections,
        missionEvaluations: nextMissionEvaluations,
      });
      setEvaluationData(response);
      setSections(response.evaluation.sections);
      setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
      setPageIndexes((current) => clampPageIndexes(response.evaluation.sections, current));
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Sauvegarde reussie.");

      const currentSection = response.evaluation.sections.find((section) => Number(section.id) === Number(activeSectionId));
      const currentPage = currentSection?.pages?.[activePageIndex];
      if (currentPage?.comment?.trim()) {
        setSavedComments((comments) => ({ ...comments, [currentPage.page_id]: currentPage.comment.trim() }));
      }

      if (!activeMissionId) {
        setActiveMissionId(response.mission_evaluations?.[0]?.id || "");
      }

      return response;
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Sauvegarde impossible.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  function goToCycleStep(direction) {
    const sectionIndex = sections.findIndex((section) => Number(section.id) === Number(activeSectionId));
    const pages = activeSection?.pages || [];
    const nextPageIndex = activePageIndex + direction;

    if (nextPageIndex >= 0 && nextPageIndex < pages.length) {
      setPageIndexes((current) => ({ ...current, [activeSectionId]: nextPageIndex }));
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
    setFeedbackMessage("");
  }

  function goToMissionStep(direction) {
    if (!activeMission || !activeMissionSection) return;

    const nextPageIndex = activeMissionPageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < (activeMissionSection.groups?.length || 0)) {
      setMissionPageIndexes((current) => ({
        ...current,
        [activeMission.id]: nextPageIndex,
      }));
      return;
    }

    const nextSection = missionSections[activeMissionSectionIndex + direction];
    if (!nextSection) return;

    setMissionSectionIds((current) => ({
      ...current,
      [activeMission.id]: nextSection.id,
    }));
    setMissionPageIndexes((current) => ({
      ...current,
      [activeMission.id]: direction > 0 ? 0 : Math.max((nextSection.groups?.length || 1) - 1, 0),
    }));
  }

  async function handleSaveAndContinue() {
    const response = await persistEvaluation(sections, missionEvaluations);
    if (response) goToCycleStep(1);
  }

  async function handleSubmitMission() {
    if (!activeMission) return;

    const hasIncompleteCriterion = (activeMission.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      setFeedbackTone("error");
      setFeedbackMessage("Toutes les questions de la mission doivent etre renseignees avant soumission.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistEvaluation(sections, missionEvaluations);
      if (!savedResponse) return;

      const response = await submitMySeniorMissionEvaluation(activeMission.id);
      setEvaluationData(response);
      setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Mission soumise au manager.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitCycle() {
    setIsSubmitting(true);

    try {
      const savedResponse = await persistEvaluation(sections, missionEvaluations);
      if (!savedResponse) return;

      const submittedResponse = await submitMySeniorEvaluation();
      setEvaluationData(submittedResponse);
      setSections(submittedResponse.evaluation.sections);
      setMissionEvaluations(sanitizeMissionEvaluations(submittedResponse.mission_evaluations || []));
      setPageIndexes(createInitialPageIndexes(submittedResponse.evaluation.sections));
      setFeedbackTone("success");
      setFeedbackMessage(submittedResponse.message || "Auto-evaluation soumise aux managers.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'auto-évaluation...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!activeSection || !activePage) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucune auto-évaluation disponible.</section>;
  }

  const isLastCycleStep =
    sections.findIndex((section) => Number(section.id) === Number(activeSectionId)) === sections.length - 1 &&
    activePageIndex === (activeSection.pages?.length || 1) - 1;

  const isLastMissionStep =
    activeMissionSectionIndex === missionSections.length - 1 &&
    activeMissionPageIndex === Math.max((activeMissionSection?.groups?.length || 1) - 1, 0);

  return (
    <section className="space-y-4">
      <div className="rounded-lg bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
        Le Senior peut saisir son évaluation par mission puis son évaluation globale du cycle. Les missions comme l'auto-évaluation globale sont transmises au(x) manager(s) concernés.
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <button
          type="button"
          onClick={() => setStep("missions")}
          className={`rounded-xl p-5 text-left ${step === "missions" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"}`}
        >
          <p className="text-xs font-bold uppercase">Etape 1</p>
          <h2 className="mt-2 text-[22px] font-extrabold">Evaluation par mission</h2>
          <p className={`mt-3 text-sm font-semibold ${step === "missions" ? "text-slate-200" : "text-slate-500"}`}>
            Missions ajoutees par le Senior - {Math.round(((missionEvaluations.filter((mission) => mission.status === "Soumise").length) / (missionEvaluations.length || 1)) * 100)}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStep("cycle")}
          className={`rounded-xl p-5 text-left ${step === "cycle" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"}`}
        >
          <p className="text-xs font-bold uppercase">Etape 2</p>
          <h2 className="mt-2 text-[22px] font-extrabold">Evaluation globale du cycle</h2>
          <p className={`mt-3 text-sm font-semibold ${step === "cycle" ? "text-slate-200" : "text-slate-500"}`}>
            {evaluationData?.assignee?.current_cycle || "Cycle 2025-2026"} - {globalProgress}%
          </p>
        </button>
      </div>

      {step === "missions" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <article className="space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[18px] font-bold text-[#0F3A63]">Ajouter une mission</h3>
              <div className="space-y-3">
                <input
                  value={missionTitle}
                  onChange={(event) => setMissionTitle(event.target.value)}
                  placeholder="Nom ou type de mission"
                  className="w-full rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
                />
                <input
                  value={missionPeriod}
                  onChange={(event) => setMissionPeriod(event.target.value)}
                  placeholder="Periode de la mission"
                  className="w-full rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
                />
                <select
                  value={effectiveRecipientValue}
                  onChange={(event) => setSelectedRecipientValue(event.target.value)}
                  className="w-full rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
                >
                  {recipientOptions.map((recipient) => (
                    <option key={getRecipientOptionValue(recipient)} value={getRecipientOptionValue(recipient)}>
                      {recipient.department} - Destinataire : {getRecipientLabel(recipient)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMission}
                  className="rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                >
                  Ajouter la mission
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {missionEvaluations.map((mission) => (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => {
                    setActiveMissionId(mission.id);
                    setFeedbackMessage("");
                  }}
                  className={`w-full rounded-xl border p-4 text-left shadow-sm transition ${
                    mission.id === activeMissionId ? "border-[#76B82A] bg-[#F3FAEA]" : "border-transparent bg-white"
                  }`}
                >
                  <p className="text-[18px] font-bold text-[#0F3A63]">{mission.title}</p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-500">{mission.period}</p>
                  <p className="mt-2 text-[12px] font-semibold text-[#0F3A63]">
                    {mission.department} - {mission.recipients.map(getRecipientLabel).join(", ")}
                  </p>
                  <div className="mt-4 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-[#76B82A]" style={{ width: `${getMissionProgress(mission)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[12px] font-bold text-[#76B82A]">{getMissionProgress(mission)}% complète</p>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#0F3A63]">{mission.status || "Brouillon"}</span>
                  </div>
                </button>
              ))}
            </div>
          </article>

          <article className="space-y-4">
            {activeMission ? (
              <>
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-500">Mission sélectionnee</p>
                      <h3 className="text-[20px] font-extrabold text-[#0F3A63]">{activeMission.title}</h3>
                    </div>
                    <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-[12px] font-bold text-[#4E8B1B]">
                      Moyenne {activeMissionAverage} / 5
                    </span>
                  </div>
                  <p className="text-[12px] font-semibold text-slate-500">{activeMission.period}</p>
                  <p className="mt-2 text-[12px] font-semibold text-[#0F3A63]">
                    Département : {activeMission.department} - Destinataire : {activeMission.recipients.map(getRecipientLabel).join(", ")}
                  </p>
                </div>

                <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {missionSections.map((section) => {
                    const progress = getMissionSectionProgress(section);
                    const isActive = section.id === activeMissionSectionId;
                    const done = progress === 100;

                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() =>
                          setMissionSectionIds((current) => ({
                            ...current,
                            [activeMission.id]: section.id,
                          }))
                        }
                        className={`rounded-md border px-3 py-3 text-left text-white transition ${
                          isActive ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]" : "border-transparent bg-[#003B63]"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <h2 className="text-[13px] font-bold">{section.title}</h2>
                          {done ? <Check size={14} className="text-white" /> : null}
                        </div>
                        <p className="text-[12px] font-semibold">{section.groups?.length || 0} titre(s)</p>
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

                {activeMissionSection && activeMissionGroup ? (
                  <>
                    <section className="rounded-xl bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-semibold text-slate-500">Pagination dans la mission</p>
                          <h3 className="text-[18px] font-bold text-[#0F3A63]">{activeMissionSection.title}</h3>
                        </div>
                        <span className="text-[12px] font-semibold text-[#0F3A63]">
                          Titre {activeMissionPageIndex + 1} / {activeMissionSection.groups?.length || 1}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(activeMissionSection.groups || []).map((group, index) => (
                          <button
                            key={group.key}
                            type="button"
                            onClick={() =>
                              setMissionPageIndexes((current) => ({
                                ...current,
                                [activeMission.id]: index,
                              }))
                            }
                            className={`rounded-md border px-3 py-2 text-left transition ${
                              index === activeMissionPageIndex
                                ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]"
                                : "border-[#D9E3EE] bg-white text-slate-600"
                            }`}
                          >
                            <p className="text-[11px] font-bold">Titre {index + 1}</p>
                            <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                            {shouldShowSourceLabel && getSourceBadgeLabel({ source_label: group.sourceLabel, source_sheet: group.sourceSheet }) && group.sourceSheet !== "TRONC COMMUN" ? (
                              <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                                {getSourceBadgeLabel({ source_label: group.sourceLabel, source_sheet: group.sourceSheet })}
                              </span>
                            ) : null}
                            <p className="mt-1 text-[10px] font-semibold text-[#76B82A]">{getMissionGroupProgress(group)}%</p>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="grid grid-cols-1">
                      <article className="rounded-xl bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-[28px] font-bold leading-none text-[#0F3A63]">{activeMissionSection.title}</h3>
                            <p className="mt-2 text-[18px] font-semibold text-[#0F3A63]">{activeMissionGroup.pageTitle}</p>
                            {shouldShowSourceLabel && activeMissionSourceBadgeLabel && activeMissionGroup.sourceSheet !== "TRONC COMMUN" ? (
                              <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[11px] font-semibold text-[#0F3A63]">
                                {activeMissionSourceBadgeLabel}
                              </span>
                            ) : null}
                            <p className="mt-2 text-[12px] font-semibold text-slate-500">Score moyen : {activeMissionAverage} / 5</p>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          {(activeMissionGroup.criteria || []).map((criterion) => (
                            <MissionScoreRow
                              key={criterion.id}
                              themeCode={criterion.themeCode}
                              label={criterion.label}
                              statement={criterion.statement}
                              selected={criterion.score}
                              onSelect={(score) => updateMissionScore(criterion.id, score)}
                            />
                          ))}
                        </div>

                        <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
                          Les questions obligatoires sans réponse bloqueront la soumission de la mission au manager.
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => goToMissionStep(-1)}
                            disabled={activeMissionSectionIndex <= 0 && activeMissionPageIndex === 0}
                            className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ChevronLeft size={14} />
                            Precedent
                          </button>

                          {!isLastMissionStep ? (
                            <button
                              type="button"
                              onClick={() => goToMissionStep(1)}
                              className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                            >
                              Titre suivant
                              <ChevronRight size={14} />
                            </button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={handleSubmitMission}
                                disabled={isSaving || isSubmitting || activeMission.status === "Soumise"}
                                className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                              >
                                {isSubmitting ? "Soumission..." : "Soumettre la mission"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setStep("cycle")}
                                className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                              >
                                Continuer vers l'évaluation globale
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    </section>
                  </>
                ) : null}
              </>
            ) : (
              <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
                Aucune mission ajoutée pour le moment.
              </section>
            )}
          </article>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.4fr]">
          <article className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400">{evaluationData?.assignee?.current_cycle || "Cycle 2025-2026"}</p>
              <h2 className="text-xl font-extrabold text-[#0F3A63]">{displayName}</h2>
              <p className="text-sm font-semibold text-slate-500">{user?.grade || evaluationData?.assignee?.grade || "Senior"}</p>
            </div>

            <div className="mb-4 flex items-center justify-between text-sm font-bold">
              <span className="text-[#0F3A63]">Progression</span>
              <span className="text-[#76B82A]">{globalProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-[#76B82A]" style={{ width: `${globalProgress}%` }} />
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-[#0F3A63]">Statut</span>
                <span className="text-right font-bold text-[#0F3A63]">{evaluationData?.evaluation?.status || "En cours"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-[#0F3A63]">Destinataire</span>
                <span className="text-right font-bold text-slate-500">{evaluationData?.assignee?.submitted_to || "Manager du departement"}</span>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-[#0F3A63]">
              Cette auto-évaluation personnelle sera envoyée au(x) manager(s) concernés pour complèter l'appréciation du cycle.
            </div>

            <div className="mt-4 space-y-4">
              <article className="rounded-xl bg-white p-4 shadow-sm">
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

              <article className="rounded-xl bg-white p-4 shadow-sm">
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
          </article>

          <article className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500">Dernière sauvegarde</p>
                <p className="text-sm font-semibold text-[#0F3A63]">{evaluationData?.evaluation?.last_saved_at ? "Enregistree" : "Non disponible"}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-[#0F3A63]">
                  Section {sections.findIndex((section) => Number(section.id) === Number(activeSectionId)) + 1} / {sections.length}
                </span>
                <button type="button" onClick={() => persistEvaluation(sections, missionEvaluations)} className="font-semibold text-[#76B82A] hover:underline">
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
                      setFeedbackMessage("");
                    }}
                    className={`rounded-md border px-3 py-3 text-left text-white transition ${
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

            <section className="rounded-xl bg-white p-4 shadow-sm">
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

            <section className="grid grid-cols-1">
              <article className="rounded-xl bg-white p-4 shadow-sm">
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
                    <p className="text-[10px] font-bold text-[#5A8A3A]">Commentaire sauvegardé</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#0F3A63]">{savedComments[activePage.page_id]}</p>
                  </div>
                ) : null}

                <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
                  Les questions obligatoires sans réponse bloqueront la soumission aux managers concernés.
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => goToCycleStep(-1)}
                    disabled={Number(activeSectionId) === Number(sections[0]?.id) && activePageIndex === 0}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={14} />
                    Précédent
                  </button>

                  {!isLastCycleStep ? (
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
                      onClick={handleSubmitCycle}
                      disabled={isSaving || isSubmitting || evaluationData?.evaluation?.status === "Soumis aux Managers"}
                      className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      {isSubmitting ? "Soumission..." : "Soumettre aux managers"}
                    </button>
                  )}
                </div>

                {feedbackMessage ? (
                  <p className={`mt-2 text-right text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
                    {feedbackMessage}
                  </p>
                ) : null}
              </article>
            </section>
          </article>
        </section>
      )}
    </section>
  );
}

export default MonautoevaluationSenior;
