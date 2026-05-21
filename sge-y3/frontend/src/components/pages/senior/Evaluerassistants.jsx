import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addSeniorAssistantMission,
  getSeniorAssistantEvaluation,
  saveSeniorAssistantEvaluation,
  submitSeniorAssistantMissionEvaluation,
  submitSeniorAssistantEvaluation,
} from "@/lib/seniorAssistants";

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - à améliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - dépasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excellent - référence dans l'équipe", color: "text-[#76B82A]" },
];

function getRecipientOptionValue(recipient) {
  return `${recipient.department}::${recipient.id}`;
}

function normalizeDepartment(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toUpperCase();
}

function shouldIncludePageForManager(page, managerDepartment) {
  const normalizedManagerDepartment = normalizeDepartment(managerDepartment);
  const normalizedSourceSheet = normalizeDepartment(page?.source_sheet);

  if (!normalizedManagerDepartment || !normalizedSourceSheet || normalizedSourceSheet === "TRONC COMMUN") {
    return true;
  }

  if (normalizedManagerDepartment === "AUDIT") {
    return normalizedSourceSheet === "AUDIT";
  }

  if (normalizedManagerDepartment === "EXPERTISE COMPTABLE") {
    return normalizedSourceSheet === "EXPERTISE COMPTABLE";
  }

  if (normalizedManagerDepartment === "AUDIT & EXPERTISE COMPTABLE") {
    return normalizedSourceSheet === "AUDIT" || normalizedSourceSheet === "EXPERTISE COMPTABLE";
  }

  return true;
}

function filterSectionsForManager(sections = [], managerDepartment = "") {
  return sections
    .map((section) => ({
      ...section,
      pages: (section.pages || []).filter((page) => shouldIncludePageForManager(page, managerDepartment)),
    }))
    .filter((section) => (section.pages || []).length > 0);
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

function getSectionProgress(section) {
  const pages = section?.pages || [];
  const totalThemes = pages.reduce((total, page) => total + (page.themes?.length || 0), 0);
  const answeredThemes = pages.reduce(
    (total, page) => total + (page.themes || []).filter((theme) => theme.score !== null && theme.score !== undefined).length,
    0
  );
  if (!totalThemes) return 0;
  return Math.round((answeredThemes / totalThemes) * 100);
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
      pageComment: criterion.pageComment || "",
      criteria: [criterion],
    });
  }

  return groups;
}

function getMissionSections(groups = []) {
  const sections = [];

  for (const group of groups) {
    const existingSection = sections.find((section) => section.title === group.sectionTitle);

    if (existingSection) {
      existingSection.groups.push(group);
      if (!existingSection.comment) {
        existingSection.comment = group.criteria?.find((criterion) => String(criterion.sectionComment || "").trim())?.sectionComment || "";
      }
      continue;
    }

    sections.push({
      id: group.sectionTitle,
      title: group.sectionTitle,
      comment: group.criteria?.find((criterion) => String(criterion.sectionComment || "").trim())?.sectionComment || "",
      groups: [group],
    });
  }

  return sections;
}

function hasRequiredSubmissionComment(sections = []) {
  return sections.length > 0 && sections.every((section) => String(section.comment || "").trim().length >= 3);
}

function getMissionSectionProgress(section) {
  const criteria = (section?.groups || []).flatMap((group) => group.criteria || []);
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function getMissionGroupProgress(group) {
  const criteria = group?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function hasRequiredMissionSectionComments(sections = []) {
  return sections.length > 0 && sections.every((section) => String(section.comment || "").trim().length >= 3);
}

function getMissionMissingLowScorePageComments(sections = []) {
  return sections.flatMap((section) =>
    (section.groups || [])
      .filter((group) => {
        const hasLowScore = (group.criteria || []).some((criterion) => typeof criterion.score === "number" && criterion.score < 3);
        return hasLowScore && String(group.pageComment || "").trim().length < 3;
      })
      .map((group) => ({
        sectionTitle: section.title,
        pageTitle: group.pageTitle,
      }))
  );
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

function ScoreRow({ theme, onSelect }) {
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

function MissionScoreRow({ criterion, onSelect }) {
  return (
    <div className="rounded-md border border-[#E3EAF3] bg-[#F8FBFF] p-3">
      <p className="text-[12px] font-semibold text-[#0F3A63]">
        {criterion.themeCode ? `${criterion.themeCode}. ` : ""}
        {criterion.label}
      </p>
      {criterion.statement ? <p className="mt-1 text-[11px] leading-5 text-slate-600">{criterion.statement}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onSelect(score)}
            className={`inline-flex h-6 w-8 items-center justify-center rounded text-[12px] font-bold ${
              criterion.score === score ? "bg-[#0B4C7A] text-white" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function Evaluerassistants({ assistants = [], isLoadingAssistants, assistantsError, selectedAssistantId, onAssistantChange }) {
  const [step, setStep] = useState("missions");
  const [reviewData, setReviewData] = useState(null);
  const [sections, setSections] = useState([]);
  const [missionReviews, setMissionReviews] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(1);
  const [pageIndexes, setPageIndexes] = useState({});
  const [activeMissionId, setActiveMissionId] = useState("");
  const [missionSectionIds, setMissionSectionIds] = useState({});
  const [missionPageIndexes, setMissionPageIndexes] = useState({});
  const [missionTitle, setMissionTitle] = useState("");
  const [missionPeriod, setMissionPeriod] = useState("");
  const [savedComments, setSavedComments] = useState({});
  const [selectedManagerValue, setSelectedManagerValue] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReview() {
      if (!selectedAssistantId) {
        setReviewData(null);
        setSections([]);
        setMissionReviews([]);
        return;
      }

      try {
        setIsLoadingReview(true);
        setReviewError("");
        const response = await getSeniorAssistantEvaluation(selectedAssistantId);

        if (cancelled) return;

        setReviewData(response);
        setSections(response.review.sections || []);
        setMissionReviews(response.mission_reviews || []);
        setActiveMissionId((current) => current || response.mission_reviews?.[0]?.id || "");
        setActiveSectionId(Number(response.review.activeSectionId || response.review.sections?.[0]?.id || 1));
        setPageIndexes(createInitialPageIndexes(response.review.sections || []));
        setSavedComments(
          Object.fromEntries(
            (response.review.sections || [])
              .filter((section) => section.comment?.trim())
              .map((section) => [section.id, section.comment.trim()])
          )
        );
      } catch (error) {
        if (!cancelled) {
          setReviewError(error.message || "Chargement de l'évaluation impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReview(false);
        }
      }
    }

    loadReview();

    return () => {
      cancelled = true;
    };
  }, [selectedAssistantId]);

  const selectedAssistant = assistants.find((assistant) => assistant.id === selectedAssistantId) || assistants[0] || null;
  const managerRecipients = reviewData?.submitted_to || [];
  const initialManagerValue = managerRecipients[0] ? getRecipientOptionValue(managerRecipients[0]) : "";
  useEffect(() => {
    if (selectedManagerValue && managerRecipients.some((manager) => getRecipientOptionValue(manager) === selectedManagerValue)) {
      return;
    }

    setSelectedManagerValue(initialManagerValue);
  }, [initialManagerValue, managerRecipients, selectedManagerValue]);

  const selectedManager = useMemo(
    () => managerRecipients.find((manager) => getRecipientOptionValue(manager) === selectedManagerValue) || null,
    [managerRecipients, selectedManagerValue]
  );
  const evaluationDepartment = reviewData?.review_context?.evaluationDepartment || reviewData?.assistant?.department || "";
  const displayedSections = useMemo(
    () =>
      reviewData?.assistant?.department === "AUDIT & EXPERTISE COMPTABLE" && evaluationDepartment
        ? filterSectionsForManager(sections, evaluationDepartment)
        : sections,
    [evaluationDepartment, reviewData?.assistant?.department, sections]
  );
  const activeSection = displayedSections.find((section) => Number(section.id) === Number(activeSectionId)) || displayedSections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const shouldShowSourceLabel = reviewData?.assistant?.department === "AUDIT & EXPERTISE COMPTABLE";
  const activePageSourceBadgeLabel = getSourceBadgeLabel(activePage);
  const completedSections = displayedSections.filter((section) => getSectionProgress(section) === 100).length;
  const selfEvaluation = reviewData?.self_evaluation || {};
  const globalProgress = Math.round(
    displayedSections.reduce((total, section) => total + getSectionProgress(section), 0) / (displayedSections.length || 1)
  );
  const activeMission = missionReviews.find((mission) => mission.id === activeMissionId) || missionReviews[0] || null;
  const missionCriteriaGroups = useMemo(() => getMissionCriteriaGroups(activeMission?.criteria || []), [activeMission]);
  const missionSections = useMemo(() => getMissionSections(missionCriteriaGroups), [missionCriteriaGroups]);
  const activeMissionSectionId = missionSectionIds[activeMissionId] || missionSections[0]?.id || "";
  const activeMissionSection = missionSections.find((section) => section.id === activeMissionSectionId) || missionSections[0] || null;
  const activeMissionSectionIndex = missionSections.findIndex((section) => section.id === activeMissionSection?.id);
  const activeMissionPageIndex = Math.min(
    missionPageIndexes[activeMissionId] || 0,
    Math.max((activeMissionSection?.groups?.length || 1) - 1, 0)
  );
  const activeMissionGroup = activeMissionSection?.groups?.[activeMissionPageIndex] || activeMissionSection?.groups?.[0] || null;
  const hasLowScoreOnActiveMissionPage = (activeMissionGroup?.criteria || []).some(
    (criterion) => typeof criterion.score === "number" && criterion.score < 3
  );
  const hasRequiredMissionPageJustification =
    !hasLowScoreOnActiveMissionPage || String(activeMissionGroup?.pageComment || "").trim().length >= 3;
  const hasLowScoreOnActivePage = (activePage?.themes || []).some((theme) => typeof theme.score === "number" && theme.score < 3);
  const hasRequiredJustification = !hasLowScoreOnActivePage || String(activePage?.comment || "").trim().length >= 3;

  useEffect(() => {
    if (!displayedSections.length) {
      return;
    }

    const hasActiveSection = displayedSections.some((section) => Number(section.id) === Number(activeSectionId));
    if (!hasActiveSection) {
      setActiveSectionId(Number(displayedSections[0].id));
    }
  }, [activeSectionId, displayedSections]);

  function syncSections(updater) {
    setSections((currentSections) => {
      const nextSections = typeof updater === "function" ? updater(currentSections) : updater;

      return nextSections.map((section) => {
        const progress = getSectionProgress(section);
        return {
          ...section,
          status: progress === 0 ? "À faire" : progress === 100 ? "Complète" : "En cours",
        };
      });
    });

    setFeedbackMessage("");
  }

  function updateScore(themeId, score) {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        return {
          ...section,
          pages: (section.pages || []).map((page) =>
            page.page_id !== activePage?.page_id
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
    setMissionReviews((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== activeMissionId
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) =>
                criterion.id === criterionId ? { ...criterion, score, status: "En cours" } : criterion
              ),
            }
      )
    );
    setFeedbackMessage("");
  }

  function updateMissionSectionComment(comment) {
    setMissionReviews((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== activeMissionId
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) =>
                criterion.sectionTitle === activeMissionSection?.title ? { ...criterion, sectionComment: comment } : criterion
              ),
            }
      )
    );
    setFeedbackMessage("");
  }

  function updateMissionPageComment(comment) {
    setMissionReviews((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== activeMissionId
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) =>
                criterion.sectionTitle === activeMissionGroup?.sectionTitle && criterion.pageTitle === activeMissionGroup?.pageTitle
                  ? { ...criterion, pageComment: comment }
                  : criterion
              ),
            }
      )
    );
    setFeedbackMessage("");
  }

  function updateComment(comment) {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(activeSectionId)) {
          return section;
        }

        return {
          ...section,
          comment,
        };
      })
    );
  }

  function updatePageComment(comment) {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(activeSectionId)) {
          return section;
        }

        return {
          ...section,
          pages: (section.pages || []).map((page) =>
            page.page_id !== activePage?.page_id
              ? page
              : {
                  ...page,
                  comment,
                }
          ),
        };
      })
    );
  }

  async function handleAddMission() {
    if (!selectedAssistantId) return;

    const title = missionTitle.trim();
    if (!title) {
      setFeedbackTone("error");
      setFeedbackMessage("Renseignez le nom de la mission a partager avec l'assistant.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await addSeniorAssistantMission(selectedAssistantId, {
        title,
        period: missionPeriod,
      });
      setReviewData(response);
      setSections(response.review.sections || []);
      setMissionReviews(response.mission_reviews || []);
      const addedMission = response.mission_reviews?.[response.mission_reviews.length - 1] || null;
      const nextMissionId = addedMission?.id || "";
      setActiveMissionId(nextMissionId);
      setMissionSectionIds((current) => ({
        ...current,
        [nextMissionId]: addedMission?.criteria?.[0]?.sectionTitle || "",
      }));
      setMissionPageIndexes((current) => ({ ...current, [nextMissionId]: 0 }));
      setMissionTitle("");
      setMissionPeriod("");
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Mission ajoutee pour l'assistant.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Ajout de mission impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  async function persistReview(nextSections = sections, nextMissionReviews = missionReviews) {
    if (!selectedAssistantId) return null;

    setIsSaving(true);

    try {
      const response = await saveSeniorAssistantEvaluation(selectedAssistantId, {
        sections: nextSections,
        missionReviews: nextMissionReviews,
      });
      setReviewData(response);
      setSections(response.review.sections);
      setMissionReviews(response.mission_reviews || []);
      setPageIndexes((current) => clampPageIndexes(response.review.sections, current));
      setSavedComments(
        Object.fromEntries(
          (response.review.sections || [])
            .filter((section) => section.comment?.trim())
            .map((section) => [section.id, section.comment.trim()])
        )
      );
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Sauvegarde réussie.");
      return response;
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Sauvegarde impossible.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  function goToGlobalStep(direction) {
    const sectionIndex = displayedSections.findIndex((section) => Number(section.id) === Number(activeSectionId));
    const pages = activeSection?.pages || [];
    const nextPageIndex = activePageIndex + direction;

    if (nextPageIndex >= 0 && nextPageIndex < pages.length) {
      setPageIndexes((current) => ({ ...current, [activeSectionId]: nextPageIndex }));
      return;
    }

    const nextSection = displayedSections[sectionIndex + direction];
    if (!nextSection) return;

    setActiveSectionId(Number(nextSection.id));
    setPageIndexes((current) => ({
      ...current,
      [nextSection.id]: direction > 0 ? 0 : Math.max((nextSection.pages?.length || 1) - 1, 0),
    }));
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
    if (!hasRequiredJustification) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour toute note inférieure à 3.");
      return;
    }

    const response = await persistReview(sections, missionReviews);
    if (response) goToGlobalStep(1);
  }

  async function handleSubmit() {
    if (!selectedAssistantId) return;
    if (!hasRequiredSubmissionComment(sections)) {
      setFeedbackTone("error");
      setFeedbackMessage("Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant transmission.");
      return;
    }

    if (!hasRequiredJustification) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour toute note inférieure à 3.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistReview(sections, missionReviews);
      if (!savedResponse) return;

      const submittedResponse = await submitSeniorAssistantEvaluation(selectedAssistantId, {
        selectedManagerRecipient: selectedManager
          ? {
              id: selectedManager.id,
              name: selectedManager.name,
              department: selectedManager.department,
            }
          : null,
      });
      setReviewData(submittedResponse);
      setSections(submittedResponse.review.sections);
      setMissionReviews(submittedResponse.mission_reviews || []);
      setPageIndexes(createInitialPageIndexes(submittedResponse.review.sections));
      setFeedbackTone("success");
      setFeedbackMessage(submittedResponse.message || "Évaluation transmise au(x) manager(s).");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Transmission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveMissionAndContinue() {
    if (!hasRequiredMissionPageJustification) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour toute note inférieure à 3 sur ce titre.");
      return;
    }

    const response = await persistReview(sections, missionReviews);
    if (response) goToMissionStep(1);
  }

  async function handleSubmitMission() {
    if (!selectedAssistantId || !activeMission) return;

    const hasIncompleteCriterion = (activeMission.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      setFeedbackTone("error");
      setFeedbackMessage("Toutes les questions de la mission doivent être renseignées avant transmission.");
      return;
    }

    if (!hasRequiredMissionSectionComments(missionSections)) {
      setFeedbackTone("error");
      setFeedbackMessage("Un commentaire d'au moins 3 caractères est obligatoire pour chaque section de la mission.");
      return;
    }

    if (getMissionMissingLowScorePageComments(missionSections).length) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour chaque titre contenant une note inférieure à 3.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistReview(sections, missionReviews);
      if (!savedResponse) return;

      const submittedResponse = await submitSeniorAssistantMissionEvaluation(selectedAssistantId, activeMission.id, {
        selectedManagerRecipient: selectedManager
          ? {
              id: selectedManager.id,
              name: selectedManager.name,
              department: selectedManager.department,
            }
          : null,
      });
      setReviewData(submittedResponse);
      setSections(submittedResponse.review.sections);
      setMissionReviews(submittedResponse.mission_reviews || []);
      setFeedbackTone("success");
      setFeedbackMessage(submittedResponse.message || "Mission transmise au(x) manager(s).");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Transmission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingAssistants) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des assistants...</section>;
  }

  if (assistantsError) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{assistantsError}</section>;
  }

  if (!assistants.length) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucun assistant partageant votre département n'est disponible.</section>;
  }

  if (isLoadingReview) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'évaluation assistant...</section>;
  }

  if (reviewError) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{reviewError}</section>;
  }

  if (!selectedAssistant || !activeSection || !activePage) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Sélectionnez un assistant pour commencer.</section>;
  }

  const isLastGlobalStep =
    displayedSections.findIndex((section) => Number(section.id) === Number(activeSectionId)) === displayedSections.length - 1 &&
    activePageIndex === (activeSection.pages?.length || 1) - 1;
  const isLastMissionStep =
    activeMissionSectionIndex === missionSections.length - 1 &&
    activeMissionPageIndex === (activeMissionSection?.groups?.length || 1) - 1;

  return (
    <section className="space-y-5">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setStep("missions")}
          className={`rounded-lg p-4 text-left transition ${step === "missions" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"}`}
        >
          <p className="text-xs font-bold uppercase opacity-80">ETAPE 1</p>
          <h2 className="mt-1 text-lg font-black">Évaluation par mission</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">
            Missions partagées avec l'assistant - {Math.round(((missionReviews.filter((mission) => mission.status === "Soumise" || mission.status === "Transmise").length) / (missionReviews.length || 1)) * 100)}%
          </p>
        </button>
        <button
          type="button"
          onClick={() => setStep("global")}
          className={`rounded-lg p-4 text-left transition ${step === "global" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"}`}
        >
          <p className="text-xs font-bold uppercase opacity-80">ETAPE 2</p>
          <h2 className="mt-1 text-lg font-black">Évaluation globale du cycle</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">Cycle 2025-2026 {globalProgress}%</p>
        </button>
      </section>

      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="assistant-select" className="mb-2 block text-xs font-bold text-[#0F3A63]">Assistant à évaluer</label>
            <select
              id="assistant-select"
              value={selectedAssistantId}
              onChange={(event) => onAssistantChange?.(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            >
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.name} - {assistant.department}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Département partagé</p>
            <p className="mt-1 text-sm font-bold text-[#0F3A63]">{selectedAssistant.department}</p>
          </div>
        </div>
      </article>

      {step === "missions" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.35fr]">
          <article className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-extrabold text-[#0F3A63]">{selectedAssistant.name}</h2>
            <p className="text-sm font-semibold text-slate-500">{selectedAssistant.grade}</p>

            <div className="mt-5 rounded-lg border border-[#D9E3EE] bg-[#F8FAFC] p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Nouvelle mission partagée</p>
              <p className="mt-1 text-sm font-semibold text-[#0F3A63]">
                L'assistant recevra cette mission dans son auto-évaluation et notera la mission de son côté.
              </p>
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={missionTitle}
                  onChange={(event) => setMissionTitle(event.target.value)}
                  placeholder="Nom de la mission"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63] outline-none"
                />
                <input
                  type="text"
                  value={missionPeriod}
                  onChange={(event) => setMissionPeriod(event.target.value)}
                  placeholder="Periode de la mission"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63] outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddMission}
                  disabled={isSaving || isSubmitting}
                  className="inline-flex rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                >
                  {isSaving ? "Ajout..." : "Ajouter pour cet assistant"}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {missionReviews.length ? missionReviews.map((mission) => {
                const isActive = mission.id === activeMission?.id;
                const progress = Math.round(((mission.criteria || []).filter((criterion) => criterion.score !== null && criterion.score !== undefined).length / ((mission.criteria || []).length || 1)) * 100);

                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => {
                      setActiveMissionId(mission.id);
                      setMissionSectionIds((current) => ({ ...current, [mission.id]: current[mission.id] || mission.criteria?.[0]?.sectionTitle || "" }));
                      setMissionPageIndexes((current) => ({ ...current, [mission.id]: current[mission.id] || 0 }));
                    }}
                    className={`w-full rounded-lg p-4 text-left transition ${isActive ? "bg-[#DFECD4]" : "bg-slate-50 hover:bg-slate-100"}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                        {mission.origin === "senior-assigned" ? (
                          <span className="mt-2 inline-flex rounded-full bg-[#E8F3D6] px-2.5 py-1 text-[10px] font-bold text-[#4E8B1B]">
                            Mission ajoutée par le sénior
                          </span>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.status}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500">{mission.period || "Période non renseignée"}</p>
                    <p className="mt-1 text-xs font-semibold text-[#0F3A63]">Destinataire : {mission.recipientName}</p>
                    <p className="mt-1 text-xs font-bold text-[#76B82A]">{progress}%</p>
                  </button>
                );
              }) : <p className="rounded-md bg-[#EEF2F6] p-4 text-sm font-semibold text-slate-500">Aucune mission partagée avec cet assistant pour le moment.</p>}
            </div>
          </article>

          <article className="rounded-xl bg-white p-5 shadow-sm">
            {activeMission ? (
              <>
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-400">Évaluation selon la mission réalisée ensemble</p>
                  <h2 className="text-xl font-extrabold text-[#0F3A63]">{activeMission.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{activeMission.period || "Période non renseignée"}</p>
                  {activeMission.origin === "senior-assigned" ? (
                    <p className="mt-2 text-xs font-semibold text-[#4E8B1B]">
                      Mission partagée avec l'assistant par {activeMission.assignedByName || "le senior"}.
                    </p>
                  ) : null}
                </div>

                {managerRecipients.length ? (
                  <section className="mb-4 rounded-md bg-white p-4 shadow-sm">
                    <label htmlFor="manager-select-mission" className="mb-2 block text-[12px] font-bold text-[#0F3A63]">
                      Manager destinataire
                    </label>
                    <select
                      id="manager-select-mission"
                      value={selectedManagerValue}
                      onChange={(event) => {
                        setSelectedManagerValue(event.target.value);
                        setFeedbackMessage("");
                      }}
                      className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                    >
                      {managerRecipients.map((manager) => (
                        <option key={getRecipientOptionValue(manager)} value={getRecipientOptionValue(manager)}>
                          {manager.department} - {manager.name} ({manager.grade})
                        </option>
                      ))}
                    </select>
                  </section>
                ) : null}

                <section className="mb-4 rounded-md bg-[#F8FAFC] p-4">
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {missionSections.map((section) => {
                      const isActive = section.id === activeMissionSection?.id;
                      const progress = getMissionSectionProgress(section);
                      const done = progress === 100;

                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => {
                            setMissionSectionIds((current) => ({ ...current, [activeMission.id]: section.id }));
                            setMissionPageIndexes((current) => ({ ...current, [activeMission.id]: 0 }));
                          }}
                          className={`rounded-md border px-3 py-3 text-left text-white transition ${isActive ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]" : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"}`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-[13px] font-bold">{section.title}</h4>
                            {done ? <Check size={14} className="text-white" /> : null}
                          </div>
                          <p className="text-[12px] font-semibold">{section.groups.length} titre(s)</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-500">Pagination dans la mission</p>
                      <h4 className="text-[16px] font-bold text-[#0F3A63]">{activeMissionSection?.title}</h4>
                    </div>
                    <span className="text-[12px] font-semibold text-[#0F3A63]">Titre {activeMissionPageIndex + 1} / {activeMissionSection?.groups?.length || 1}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(activeMissionSection?.groups || []).map((group, index) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setMissionPageIndexes((current) => ({ ...current, [activeMission.id]: index }))}
                        className={`rounded-md border px-3 py-2 text-left transition ${index === activeMissionPageIndex ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]" : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        <p className="text-[11px] font-bold">Titre {index + 1}</p>
                        <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                        {shouldShowSourceLabel && group.sourceSheet !== "TRONC COMMUN" ? (
                          <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                            {group.sourceLabel || getSourceBadgeLabel({ source_sheet: group.sourceSheet })}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>

                {activeMissionGroup ? (
                  <div className="space-y-3.5">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500">{activeMissionGroup.sectionTitle}</p>
                      <p className="mt-1 text-[15px] font-bold text-[#0F3A63]">{activeMissionGroup.pageTitle}</p>
                    </div>
                    {activeMissionGroup.criteria.map((criterion) => (
                      <MissionScoreRow key={criterion.id} criterion={criterion} onSelect={(score) => updateMissionScore(criterion.id, score)} />
                    ))}
                    {hasLowScoreOnActiveMissionPage ? (
                      <div className="rounded-md border border-[#F0C7C7] bg-[#FFF7F7] p-3">
                        <label className="text-[12px] font-bold text-[#A4252F]">
                          Justification de l'écart pour ce titre <span className="text-[11px] text-slate-500">(minimum 3 caractères)</span>
                        </label>
                        <textarea
                          value={activeMissionGroup.pageComment || ""}
                          onChange={(event) => updateMissionPageComment(event.target.value)}
                          rows={3}
                          placeholder="Expliquez la note inférieure à 3 pour ce titre..."
                          className="mt-2 w-full resize-none rounded-md bg-white px-3 py-2 text-[12px] text-[#0F3A63] outline-none ring-1 ring-[#F0C7C7] focus:ring-[#A4252F]"
                        />
                      </div>
                    ) : null}
                    <div className="rounded-md bg-[#F8FAFC] p-3">
                      <label className="text-[12px] font-bold text-[#0F3A63]">
                        Commentaire global de la section <span className="text-[11px] text-slate-500">(minimum 3 caractères)</span>
                      </label>
                      <textarea
                        value={activeMissionSection?.comment || ""}
                        onChange={(event) => updateMissionSectionComment(event.target.value)}
                        rows={3}
                        placeholder="Synthèse globale de la section pour cette mission..."
                        className="mt-2 w-full resize-none rounded-md bg-white px-3 py-2 text-[12px] text-[#0F3A63] outline-none ring-1 ring-[#D9E3EE] focus:ring-[#76B82A]"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex justify-end">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => goToMissionStep(-1)}
                      disabled={activeMissionSectionIndex === 0 && activeMissionPageIndex === 0}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft size={14} />
                      Précédent
                    </button>
                    {!isLastMissionStep ? (
                      <button
                        type="button"
                        onClick={handleSaveMissionAndContinue}
                        className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                      >
                        Sauvegarder et continuer
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSubmitMission}
                          disabled={isSaving || isSubmitting}
                          className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                        >
                          {isSubmitting ? "Transmission..." : activeMission?.status === "Transmise" ? "Retransmettre la mission" : "Transmettre la mission au Manager"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep("global")}
                          className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                        >
                          Continuer vers l'évaluation globale
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-[#EEF2F6] p-5 text-sm font-semibold text-slate-500">Aucune mission commune disponible pour cet assistant.</div>
            )}
          </article>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.4fr]">
          <article className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400">{reviewData?.review?.cycle_label || "Cycle 2025-2026"}</p>
              <h2 className="text-xl font-extrabold text-[#0F3A63]">{selectedAssistant.name}</h2>
              <p className="text-sm font-semibold text-slate-500">{selectedAssistant.grade}</p>
            </div>

            <div className="mb-4 flex items-center justify-between text-sm font-bold">
              <span className="text-[#0F3A63]">Progression</span>
              <span className="text-[#76B82A]">{globalProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-[#76B82A]" style={{ width: `${globalProgress}%` }} />
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-[#0F3A63]">
              Le Sénior peut évaluer l'assistant globalement sur le cycle et voir les réponses de son auto-évaluation globale.
            </div>
            {reviewData?.assistant?.department === "AUDIT & EXPERTISE COMPTABLE" &&
            evaluationDepartment &&
            evaluationDepartment !== "AUDIT & EXPERTISE COMPTABLE" ? (
              <div className="mt-3 rounded-lg bg-[#EEF6E8] p-4 text-sm font-semibold text-[#4E8B1B]">
                Cette évaluation utilise les questions du département {evaluationDepartment}.
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <article className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[22px] font-bold text-[#0F3A63]">Progression globale</h3>
                  <span className="text-[13px] font-bold text-[#76B82A]">{globalProgress}%</span>
                </div>
                <p className="mb-4 text-[12px] font-semibold text-[#76B82A]">{completedSections} section(s) complétée(s)</p>

                <div className="space-y-3">
                  {displayedSections.map((section) => (
                    <div key={section.id} className="flex items-center justify-between text-[12px]">
                      <p className="font-semibold text-[#0F3A63]">{section.title}</p>
                      <span className="font-bold text-[#76B82A]">{getSectionProgress(section)}%</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[20px] font-bold text-[#0F3A63]">Auto-évaluation de l'assistant</h3>
                  <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-[11px] font-bold text-[#0F3A63]">
                    {typeof selfEvaluation.overallAverage === "number" ? `${selfEvaluation.overallAverage} / 5` : "--"}
                  </span>
                </div>
                <p className="text-[12px] font-semibold text-slate-500">{selfEvaluation.status || "En attente"}</p>
                <div className="mt-3 space-y-2">
                  {(selfEvaluation.sectionScores || []).map((section) => {
                    const comment = (selfEvaluation.sectionComments || []).find((item) => item.sectionId === section.sectionId)?.comment;

                    return (
                      <div key={section.sectionId} className="rounded-md bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] font-bold text-[#0F3A63]">{section.title}</p>
                          <p className="text-[12px] font-bold text-[#76B82A]">{section.score ?? "--"} / 5</p>
                        </div>
                        <p className="mt-2 text-[12px] font-semibold text-slate-600">{comment || "Aucun commentaire de section."}</p>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-xl bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Aide à la notation</h3>
                <div className="space-y-2">
                  {gradingHelp.map((item) => (
                    <div key={item.level} className="flex items-center gap-2 text-[12px]">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 font-bold text-slate-500">{item.level}</span>
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
                <p className="text-sm font-semibold text-[#0F3A63]">{reviewData?.review?.last_saved_at ? "Enregistrée" : "Non disponible"}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-[#0F3A63]">Section {displayedSections.findIndex((section) => Number(section.id) === Number(activeSectionId)) + 1} / {displayedSections.length}</span>
                <button type="button" onClick={() => persistReview(sections, missionReviews)} className="font-semibold text-[#76B82A] hover:underline">
                  {isSaving ? "Sauvegarde..." : "Sauvegarder maintenant"}
                </button>
              </div>
            </div>

            {managerRecipients.length ? (
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <label htmlFor="manager-select-global" className="mb-2 block text-[12px] font-bold text-[#0F3A63]">
                  Manager destinataire
                </label>
                <select
                  id="manager-select-global"
                  value={selectedManagerValue}
                  onChange={(event) => {
                    setSelectedManagerValue(event.target.value);
                    setFeedbackMessage("");
                  }}
                  className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                >
                  {managerRecipients.map((manager) => (
                    <option key={getRecipientOptionValue(manager)} value={getRecipientOptionValue(manager)}>
                      {manager.department} - {manager.name} ({manager.grade})
                    </option>
                  ))}
                </select>
              </section>
            ) : null}

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {displayedSections.map((section) => {
                const progress = getSectionProgress(section);
                const done = section.status === "Complete";

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      setActiveSectionId(Number(section.id));
                      setFeedbackMessage("");
                    }}
                    className={`rounded-md border px-3 py-3 text-left text-white transition ${Number(activeSectionId) === Number(section.id) ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]" : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-[13px] font-bold">{section.title}</h2>
                      {done ? <Check size={14} className="text-white" /> : null}
                    </div>
                    <p className="text-[12px] font-semibold">{section.pages?.length || 0} titre(s)</p>
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
                <span className="text-[12px] font-semibold text-[#0F3A63]">Titre {activePageIndex + 1} / {activeSection.pages?.length || 1}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(activeSection.pages || []).map((page, index) => (
                  <button
                    key={page.page_id}
                    type="button"
                    onClick={() => setPageIndexes((current) => ({ ...current, [activeSection.id]: index }))}
                    className={`rounded-md border px-3 py-2 text-left transition ${index === activePageIndex ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]" : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    <p className="text-[11px] font-bold">Titre {index + 1}</p>
                    <p className="mt-1 text-[12px] font-semibold">{page.title}</p>
                    {shouldShowSourceLabel && getSourceBadgeLabel(page) && page.source_sheet !== "TRONC COMMUN" ? (
                      <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                        {getSourceBadgeLabel(page)}
                      </span>
                    ) : null}
                    <p className="mt-1 text-[10px] font-semibold text-[#76B82A]">{getPageProgress(page)}%</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[28px] font-bold leading-none text-[#0F3A63]">{activeSection.title}</h3>
                  <p className="mt-2 text-[18px] font-semibold text-[#0F3A63]">{activePage.title}</p>
                  {shouldShowSourceLabel && activePageSourceBadgeLabel && activePage.source_sheet !== "TRONC COMMUN" ? (
                    <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[11px] font-semibold text-[#0F3A63]">{activePageSourceBadgeLabel}</span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3.5">
                {(activePage.themes || []).map((theme) => (
                  <ScoreRow key={theme.theme_id} theme={theme} onSelect={(score) => updateScore(theme.theme_id, score)} />
                ))}
              </div>

              {hasLowScoreOnActivePage ? (
                <div className="mt-4 rounded-md bg-[#FDEBEC] px-3 py-2 text-[11px] font-semibold text-[#B93840]">
                  Une note inférieure à 3 a été détectée. Merci de justifier cet écart sur ce titre.
                </div>
              ) : null}

              <div className="mt-4">
                {hasLowScoreOnActivePage ? (
                  <>
                    <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Justification du titre</p>
                    <textarea
                      rows={3}
                      value={activePage?.comment || ""}
                      onChange={(event) => updatePageComment(event.target.value)}
                      placeholder="Expliquez la raison des notes inférieures à 3 pour ce titre..."
                      className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                    />
                  </>
                ) : null}
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">
                  Commentaire de section
                </p>
                <textarea
                  rows={4}
                  value={activeSection.comment || ""}
                  onChange={(event) => updateComment(event.target.value)}
                  placeholder="Avis global du Senior sur la section, faits observés, points forts, axes de progrès..."
                  className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                />
              </div>

              {savedComments[activeSection.id] ? (
                <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2">
                  <p className="text-[10px] font-bold text-[#5A8A3A]">Commentaire sauvegardé</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#0F3A63]">{savedComments[activeSection.id]}</p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                    onClick={() => goToGlobalStep(-1)}
                    disabled={Number(activeSectionId) === Number(displayedSections[0]?.id) && activePageIndex === 0}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                  <ChevronLeft size={14} />
                  Précédent
                </button>

                {!isLastGlobalStep ? (
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
                    disabled={isSaving || isSubmitting}
                    className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                  >
                    {isSubmitting ? "Transmission..." : reviewData?.review?.status === "Transmis au Manager" ? "Retransmettre au Manager" : "Transmettre au Manager"}
                  </button>
                )}
              </div>
            </section>
          </article>
        </section>
      )}

      {feedbackMessage ? (
        <p className={`text-right text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>{feedbackMessage}</p>
      ) : null}
    </section>
  );
}

export default Evaluerassistants;
