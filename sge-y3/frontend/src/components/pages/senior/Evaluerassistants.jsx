import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addSeniorAssistantMission,
  getSeniorAssistantEvaluation,
  saveSeniorAssistantEvaluation,
  submitSeniorAssistantEvaluation,
  submitSeniorAssistantMissionEvaluation,
} from "@/lib/seniorAssistants";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";

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

function getRecipientLabel(recipient) {
  if (!recipient?.name) return "";
  if (!recipient?.grade) return recipient.name;
  return `${recipient.name} (${recipient.grade})`;
}

function formatDisplayDate(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatMissionPeriodLabel(startDate, endDate) {
  if (startDate && endDate) {
    return `Du ${formatDisplayDate(startDate)} au ${formatDisplayDate(endDate)}`;
  }

  if (startDate) {
    return `À partir du ${formatDisplayDate(startDate)}`;
  }

  if (endDate) {
    return `Jusqu'au ${formatDisplayDate(endDate)}`;
  }

  return "";
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
        existingSection.comment =
          group.criteria?.find((criterion) => String(criterion.sectionComment || "").trim())?.sectionComment || "";
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

function getMissionProgress(mission) {
  const criteria = mission?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;

  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function getMissionAverage(criteria = []) {
  const scores = criteria.map((criterion) => criterion.score).filter((score) => typeof score === "number");

  if (!scores.length) return null;
  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function getMissionFinalScore(missions = []) {
  const missionScores = missions
    .map((mission) => getMissionAverage(mission.criteria || []))
    .filter((score) => typeof score === "number");

  if (!missionScores.length) return "--";
  return (missionScores.reduce((total, score) => total + score, 0) / missionScores.length).toFixed(1);
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
  const [reviewData, setReviewData] = useState(null);
  const [missionReviews, setMissionReviews] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState("");
  const [missionSectionIds, setMissionSectionIds] = useState({});
  const [missionPageIndexes, setMissionPageIndexes] = useState({});
  const [missionTitle, setMissionTitle] = useState("");
  const [missionStartDate, setMissionStartDate] = useState("");
  const [missionEndDate, setMissionEndDate] = useState("");
  const [selectedMissionManagerValue, setSelectedMissionManagerValue] = useState("");
  const [selectedMissionManagerValues, setSelectedMissionManagerValues] = useState([]);
  const [selectedManagerValue, setSelectedManagerValue] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [feedbackAnchor, setFeedbackAnchor] = useState("");
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReview() {
      if (!selectedAssistantId) {
        setReviewData(null);
        setMissionReviews([]);
        setActiveMissionId("");
        return;
      }

      try {
        setIsLoadingReview(true);
        setReviewError("");
        const response = await getSeniorAssistantEvaluation(selectedAssistantId);

        if (cancelled) return;

        setReviewData(response);
        setMissionReviews(response.mission_reviews || []);
        setActiveMissionId(response.mission_reviews?.[0]?.id || "");
        setFeedbackMessage("");
        setSelectedMissionManagerValue("");
        setSelectedMissionManagerValues([]);
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
  const managerRecipients = useMemo(() => reviewData?.submitted_to || [], [reviewData?.submitted_to]);
  const selectedMissionManagers = useMemo(
    () =>
      managerRecipients.filter((manager) =>
        selectedMissionManagerValues.includes(getRecipientOptionValue(manager))
      ),
    [managerRecipients, selectedMissionManagerValues]
  );
  const effectiveManagerValue =
    selectedManagerValue && managerRecipients.some((manager) => getRecipientOptionValue(manager) === selectedManagerValue)
      ? selectedManagerValue
      : managerRecipients[0]
      ? getRecipientOptionValue(managerRecipients[0])
      : "";
  const selectedManager = managerRecipients.find((manager) => getRecipientOptionValue(manager) === effectiveManagerValue) || null;
  const effectiveMissionId = missionReviews.some((mission) => mission.id === activeMissionId) ? activeMissionId : missionReviews[0]?.id || "";
  const activeMission = missionReviews.find((mission) => mission.id === effectiveMissionId) || null;
  const missionCriteriaGroups = useMemo(() => getMissionCriteriaGroups(activeMission?.criteria || []), [activeMission]);
  const missionSections = useMemo(() => getMissionSections(missionCriteriaGroups), [missionCriteriaGroups]);
  const activeMissionSectionId = missionSectionIds[effectiveMissionId] || missionSections[0]?.id || "";
  const activeMissionSection = missionSections.find((section) => section.id === activeMissionSectionId) || missionSections[0] || null;
  const activeMissionSectionIndex = missionSections.findIndex((section) => section.id === activeMissionSection?.id);
  const activeMissionPageIndex = Math.min(
    missionPageIndexes[effectiveMissionId] || 0,
    Math.max((activeMissionSection?.groups?.length || 1) - 1, 0)
  );
  const activeMissionGroup = activeMissionSection?.groups?.[activeMissionPageIndex] || activeMissionSection?.groups?.[0] || null;
  const hasLowScoreOnActiveMissionPage = (activeMissionGroup?.criteria || []).some(
    (criterion) => typeof criterion.score === "number" && criterion.score < 3
  );
  const missionProgress = missionReviews.length
    ? Math.round(missionReviews.reduce((total, mission) => total + getMissionProgress(mission), 0) / missionReviews.length)
    : 0;
  const submittedMissionsCount = missionReviews.filter((mission) => mission.status === "Transmise").length;
  const finalMissionScore = useMemo(() => getMissionFinalScore(missionReviews), [missionReviews]);
  const assistantMissionSummary = reviewData?.self_evaluation?.missionSummary || null;
  const assistantMissionEvaluations = reviewData?.self_evaluation?.missionEvaluations || [];
  const isLastMissionStep =
    activeMissionSectionIndex === missionSections.length - 1 &&
    activeMissionPageIndex === Math.max((activeMissionSection?.groups?.length || 1) - 1, 0);

  function normalizeLoadedResponse(response) {
    setReviewData(response);
    setMissionReviews(response.mission_reviews || []);
  }

  function showFeedback(anchor, tone, message) {
    setFeedbackAnchor(anchor);
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  }

  function addSelectedMissionManager() {
    if (!selectedMissionManagerValue) return;

    setSelectedMissionManagerValues((current) =>
      current.includes(selectedMissionManagerValue) ? current : [...current, selectedMissionManagerValue]
    );
    setSelectedMissionManagerValue("");
    setFeedbackMessage("");
    setFeedbackAnchor("");
  }

  function removeSelectedMissionManager(value) {
    setSelectedMissionManagerValues((current) => current.filter((item) => item !== value));
    setFeedbackMessage("");
    setFeedbackAnchor("");
  }

  function getSelectedManagerPayload() {
    return selectedManager
      ? {
          id: selectedManager.id,
          name: selectedManager.name,
          department: selectedManager.department,
        }
      : null;
  }

  async function persistReview(nextMissionReviews = missionReviews, feedbackAnchorName = "mission-actions") {
    if (!selectedAssistantId) return null;

    setIsSaving(true);

    try {
      const response = await saveSeniorAssistantEvaluation(selectedAssistantId, {
        missionReviews: nextMissionReviews,
      });
      normalizeLoadedResponse(response);
      showFeedback(feedbackAnchorName, "success", response.message || "?valuation par mission enregistr?e.");
      return response;
    } catch (error) {
      showFeedback(feedbackAnchorName, "error", error.message || "Sauvegarde impossible.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  function updateMissionScore(criterionId, score) {
    setMissionReviews((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== effectiveMissionId
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
    setFeedbackAnchor("");
  }

  function updateMissionSectionComment(comment) {
    setMissionReviews((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== effectiveMissionId
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
    setFeedbackAnchor("");
  }

  function updateMissionPageComment(comment) {
    setMissionReviews((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== effectiveMissionId
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
    setFeedbackAnchor("");
  }

  function goToMissionStep(direction) {
    if (!activeMission || !activeMissionSection) return;

    const nextPageIndex = activeMissionPageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < (activeMissionSection.groups?.length || 0)) {
      setMissionPageIndexes((current) => ({ ...current, [activeMission.id]: nextPageIndex }));
      return;
    }

    const nextSection = missionSections[activeMissionSectionIndex + direction];
    if (!nextSection) return;

    setMissionSectionIds((current) => ({ ...current, [activeMission.id]: nextSection.id }));
    setMissionPageIndexes((current) => ({
      ...current,
      [activeMission.id]: direction > 0 ? 0 : Math.max((nextSection.groups?.length || 1) - 1, 0),
    }));
  }

  async function handleAddMission() {
    if (!selectedAssistantId) return;

    const title = missionTitle.trim();
    if (!title) {
      showFeedback("mission-form", "error", "Renseignez le nom de la mission ? partager avec l'assistant.");
      return;
    }

    if (missionStartDate && missionEndDate && missionEndDate < missionStartDate) {
      showFeedback("mission-form", "error", "La date de fin doit ?tre post?rieure ou ?gale ? la date de d?but.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await addSeniorAssistantMission(selectedAssistantId, {
        title,
        period: formatMissionPeriodLabel(missionStartDate, missionEndDate),
        selectedManagerRecipients: selectedMissionManagers.map((manager) => ({
          id: manager.id,
          name: manager.name,
          department: manager.department,
        })),
      });
      normalizeLoadedResponse(response);
      const addedMission = response.mission_reviews?.[response.mission_reviews.length - 1] || null;
      const nextMissionId = addedMission?.id || "";
      setActiveMissionId(nextMissionId);
      setMissionSectionIds((current) => ({
        ...current,
        [nextMissionId]: addedMission?.criteria?.[0]?.sectionTitle || "",
      }));
      setMissionPageIndexes((current) => ({ ...current, [nextMissionId]: 0 }));
      setMissionTitle("");
      setMissionStartDate("");
      setMissionEndDate("");
      setSelectedMissionManagerValue("");
      setSelectedMissionManagerValues([]);
      showFeedback("mission-form", "success", response.message || "Mission ajout?e pour l'assistant.");
    } catch (error) {
      showFeedback("mission-form", "error", error.message || "Ajout de mission impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveMissionAndContinue() {
    if (hasLowScoreOnActiveMissionPage && String(activeMissionGroup?.pageComment || "").trim().length < 3) {
      showFeedback("mission-actions", "error", "Une justification est requise pour toute note inf?rieure ? 3 sur ce titre.");
      return;
    }

    const response = await persistReview(missionReviews, "mission-actions");
    if (response) goToMissionStep(1);
  }

  async function handleSubmitMission() {
    if (!selectedAssistantId || !activeMission) return;

    const hasIncompleteCriterion = (activeMission.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      showFeedback("mission-actions", "error", "Toutes les questions de la mission doivent ?tre renseign?es avant transmission.");
      return;
    }

    if (!hasRequiredMissionSectionComments(missionSections)) {
      showFeedback("mission-actions", "error", "Un commentaire d?au moins 3 caract?res est obligatoire pour chaque section de la mission.");
      return;
    }

    if (getMissionMissingLowScorePageComments(missionSections).length) {
      showFeedback("mission-actions", "error", "Une justification est requise pour chaque titre contenant une note inf?rieure ? 3.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistReview(missionReviews, "mission-actions");
      if (!savedResponse) return;

      const response = await submitSeniorAssistantMissionEvaluation(selectedAssistantId, activeMission.id, {
        selectedManagerRecipient: getSelectedManagerPayload(),
      });
      normalizeLoadedResponse(response);
      showFeedback("mission-actions", "success", response.message || "Mission transmise au manager.");
    } catch (error) {
      showFeedback("mission-actions", "error", error.message || "Transmission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFinalizeReview() {
    if (!selectedAssistantId) return;

    if (!missionReviews.length) {
      showFeedback("finalize", "error", "Ajoutez au moins une mission avant la soumission finale.");
      return;
    }

    if (missionReviews.some((mission) => mission.status !== "Transmise")) {
      showFeedback("finalize", "error", "Chaque mission doit ?tre transmise avant la soumission finale.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistReview(missionReviews, "finalize");
      if (!savedResponse) return;

      const response = await submitSeniorAssistantEvaluation(selectedAssistantId, {
        selectedManagerRecipient: getSelectedManagerPayload(),
      });
      normalizeLoadedResponse(response);
      showFeedback("finalize", "success", response.message || "?valuations par mission transmises au manager.");
    } catch (error) {
      showFeedback("finalize", "error", error.message || "Soumission finale impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingAssistants) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des assistants…</section>;
  }

  if (assistantsError) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{assistantsError}</section>;
  }

  if (!assistants.length) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucun assistant partageant votre département n'est disponible.</section>;
  }

  if (isLoadingReview) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'évaluation assistant…</section>;
  }

  if (reviewError) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{reviewError}</section>;
  }

  if (!selectedAssistant) {
    return <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Sélectionnez un assistant pour commencer.</section>;
  }

  return (
    <section className="space-y-5">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_auto]">
          <div>
            <label htmlFor="assistant-select" className="mb-2 block text-xs font-bold text-[#0F3A63]">
              Assistant à évaluer
            </label>
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
            <p className="text-xs font-semibold text-slate-500">Département</p>
            <p className="mt-1 text-sm font-bold text-[#0F3A63]">{selectedAssistant.department}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Grade</p>
            <p className="mt-1 text-sm font-bold text-[#0F3A63]">{selectedAssistant.grade}</p>
          </div>
        </div>
      </article>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <article className="space-y-5">
          <article className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-[30px] font-black text-[#0F3A63]">{selectedAssistant.name}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Le Senior évalue désormais uniquement par mission. Les commentaires de section sont obligatoires et toute note inférieure à 3 doit être justifiée.
            </p>

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
                  placeholder="Nom ou type de mission"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63] outline-none"
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#0F3A63]">Date de d?but</label>
                    <input
                      type="date"
                      value={missionStartDate}
                      onChange={(event) => setMissionStartDate(event.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63] outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#0F3A63]">Date de fin</label>
                    <input
                      type="date"
                      min={missionStartDate || undefined}
                      value={missionEndDate}
                      onChange={(event) => setMissionEndDate(event.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63] outline-none"
                    />
                  </div>
                </div>
                <div className="rounded-md bg-white p-3">
                  <p className="text-[12px] font-bold text-[#0F3A63]">Managers sélectionnés</p>
                  {selectedMissionManagers.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedMissionManagers.map((manager) => {
                        const value = getRecipientOptionValue(manager);
                        return (
                          <span
                            key={value}
                            className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#EEF6E8] px-3 py-1.5 text-[11px] font-semibold text-[#0F3A63]"
                          >
                            <span className="truncate">
                              {manager.department} - {getRecipientLabel(manager)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSelectedMissionManager(value)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#0F3A63]"
                              aria-label={`Retirer ${getRecipientLabel(manager)}`}
                            >
                              x
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">Aucun manager sélectionné pour le moment.</p>
                  )}
                  {managerRecipients.length ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={selectedMissionManagerValue}
                        onChange={(event) => {
                          setSelectedMissionManagerValue(event.target.value);
                          setFeedbackMessage("");
                        setFeedbackAnchor("");
                        }}
                        className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
                      >
                        <option value="">Sélectionner un manager</option>
                        {managerRecipients.map((manager) => {
                          const value = getRecipientOptionValue(manager);
                          const isAlreadySelected = selectedMissionManagerValues.includes(value);

                          return (
                            <option key={value} value={value} disabled={isAlreadySelected}>
                              {manager.department} - {getRecipientLabel(manager)}
                              {isAlreadySelected ? " - d?j? s?lectionn?" : ""}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={addSelectedMissionManager}
                        disabled={!selectedMissionManagerValue}
                        className="h-10 rounded-md bg-[#0B4C7A] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleAddMission}
                  disabled={isSaving || isSubmitting}
                  className="inline-flex rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                >
                  {isSaving ? "Ajout…" : "Ajouter la mission"}
                </button>
                {feedbackAnchor === "mission-form" && feedbackMessage ? (
                  <p className={`mt-2 text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
                    {feedbackMessage}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-[#F8FAFC] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-[20px] font-bold text-[#0F3A63]">Synthèse des missions</h3>
                <span className={`rounded-full bg-white px-3 py-1 text-[12px] font-bold ${getProgressToneClass(missionProgress)}`}>{missionProgress}%</span>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                Score final = somme des scores de mission divisée par le nombre de missions notées.
              </p>
              <div className="mt-4 h-2 rounded-full bg-slate-200">
                <div className={`h-2 rounded-full ${getProgressBarClass(missionProgress)}`} style={{ width: `${clampProgress(missionProgress)}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">Missions</p>
                  <p className="mt-1 text-lg font-black text-[#0F3A63]">{missionReviews.length}</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">Transmises</p>
                  <p className="mt-1 text-lg font-black text-[#0F3A63]">{submittedMissionsCount}</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">Score final</p>
                  <p className="mt-1 text-lg font-black text-[#76B82A]">{finalMissionScore}</p>
                </div>
              </div>
            </div>

            {assistantMissionSummary ? (
              <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#E6EDF5]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[18px] font-bold text-[#0F3A63]">Auto-évaluation de l'assistant</h3>
                  <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-[11px] font-bold text-[#0F3A63]">
                    {assistantMissionSummary.finalScore ?? "--"} / 5
                  </span>
                </div>
                <p className="text-[12px] font-semibold text-slate-500">{reviewData?.self_evaluation?.status || "En attente"}</p>
                <div className="mt-3 space-y-2">
                  {assistantMissionEvaluations.length ? (
                    assistantMissionEvaluations.map((mission) => (
                      <div key={mission.id} className="rounded-md bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] font-bold text-[#0F3A63]">{mission.title}</p>
                          <p className="text-[12px] font-bold text-[#76B82A]">{getMissionAverage(mission.criteria || []) ?? "--"} / 5</p>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{mission.period || "Période non renseignée"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md bg-slate-50 px-3 py-3 text-[12px] font-semibold text-slate-500">
                      Aucune mission auto-évaluée pour le moment.
                    </p>
                  )}
                </div>
              </article>
            ) : null}

            {(reviewData?.self_evaluation?.chiefComments || []).length > 0 && (
              <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#C3DFAA]">
                <h3 className="mb-3 text-[16px] font-bold text-[#0F3A63]">Commentaire anonyme reçu</h3>
                <div className="space-y-2">
                  {(reviewData?.self_evaluation?.chiefComments || []).map((item, index) => (
                    <div key={index} className="rounded-md bg-[#F4FAED] p-3">
                      <p className="text-[12px] font-semibold text-slate-700">{item.comment}</p>
                    </div>
                  ))}
                </div>
              </article>
            )}

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
          </article>

          <article className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[20px] font-bold text-[#0F3A63]">Missions de l'assistant</h3>
              <button
                type="button"
                onClick={() => persistReview(missionReviews)}
                className="text-[12px] font-bold text-[#76B82A] hover:underline"
              >
                {isSaving ? "Sauvegarde…" : "Enregistrer"}
              </button>
            </div>

            <div className="space-y-3">
              {missionReviews.length ? (
                missionReviews.map((mission) => {
                  const isActive = mission.id === effectiveMissionId;
                  const progress = getMissionProgress(mission);

                  return (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => {
                        setActiveMissionId(mission.id);
                        setMissionSectionIds((current) => ({
                          ...current,
                          [mission.id]: current[mission.id] || mission.criteria?.[0]?.sectionTitle || "",
                        }));
                        setMissionPageIndexes((current) => ({ ...current, [mission.id]: current[mission.id] || 0 }));
                        setFeedbackMessage("");
                      }}
                      className={`w-full rounded-lg p-4 text-left transition ${
                        isActive ? "border border-[#76B82A] bg-[#F3FAEA]" : "border border-transparent bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                          {mission.origin === "senior-assigned" ? (
                            <span className="mt-2 inline-flex rounded-full bg-[#E8F3D6] px-2.5 py-1 text-[10px] font-bold text-[#4E8B1B]">
                              Mission ajoutée par le Senior
                            </span>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.status || "Brouillon"}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">{mission.period || "Période non renseignée"}</p>
                      <p className="mt-1 text-xs font-semibold text-[#0F3A63]">Destinataire : {mission.recipientName || "Manager"}</p>
                      <p className={`mt-1 text-xs font-bold ${getProgressToneClass(progress)}`}>{progress}%</p>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-md bg-[#EEF2F6] p-4 text-sm font-semibold text-slate-500">
                  Aucune mission partagée avec cet assistant pour le moment.
                </p>
              )}
            </div>
          </article>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          {activeMission ? (
            <>
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400">Évaluation selon la mission réalisée ensemble</p>
                <h2 className="text-xl font-extrabold text-[#0F3A63]">{activeMission.title}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{activeMission.period || "Période non renseignée"}</p>
              </div>

              {managerRecipients.length ? (
                <section className="mb-4 rounded-md bg-white p-4 shadow-sm ring-1 ring-[#E6EDF5]">
                  <label htmlFor="manager-select-mission" className="mb-2 block text-[12px] font-bold text-[#0F3A63]">
                    Manager destinataire
                  </label>
                  <select
                    id="manager-select-mission"
                    value={effectiveManagerValue}
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
                        className={`rounded-md border px-3 py-3 text-left text-white transition ${
                          isActive ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]" : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"
                        }`}
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
                  <span className="text-[12px] font-semibold text-[#0F3A63]">
                    Titre {activeMissionPageIndex + 1} / {activeMissionSection?.groups?.length || 1}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(activeMissionSection?.groups || []).map((group, index) => {
                    const progress = getMissionGroupProgress(group);

                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setMissionPageIndexes((current) => ({ ...current, [activeMission.id]: index }))}
                        className={`rounded-md border px-3 py-2 text-left transition ${
                          index === activeMissionPageIndex ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]" : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-[11px] font-bold">Titre {index + 1}</p>
                        <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                        <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(progress)}`}>{progress}%</p>
                      </button>
                    );
                  })}
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
                        placeholder="Expliquez la note inférieure à 3 pour ce titre…"
                        className="mt-2 w-full resize-none rounded-md bg-white px-3 py-2 text-[12px] text-[#0F3A63] outline-none ring-1 ring-[#F0C7C7] focus:ring-[#A4252F]"
                      />
                    </div>
                  ) : null}

                  <div className="rounded-md bg-[#F8FAFC] p-3">
                    <label className="text-[12px] font-bold text-[#0F3A63]">
                      Commentaire de section obligatoire <span className="text-[11px] text-slate-500">(minimum 3 caractères)</span>
                    </label>
                    <textarea
                      value={activeMissionSection?.comment || ""}
                      onChange={(event) => updateMissionSectionComment(event.target.value)}
                      rows={3}
                      placeholder="Synthèse globale de la section pour cette mission…"
                      className="mt-2 w-full resize-none rounded-md bg-white px-3 py-2 text-[12px] text-[#0F3A63] outline-none ring-1 ring-[#D9E3EE] focus:ring-[#76B82A]"
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
                      {isSubmitting ? "Transmission…" : activeMission.status === "Transmise" ? "Retransmettre la mission" : "Transmettre la mission"}
                    </button>
                    <button
                      type="button"
                      onClick={() => persistReview(missionReviews)}
                      className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                    >
                      Enregistrer la mission
                    </button>
                  </div>
                )}
              </div>
              {feedbackAnchor === "mission-actions" && feedbackMessage ? (
                <p className={`mt-2 text-right text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
                  {feedbackMessage}
                </p>
              ) : null}
            </>
          ) : (
            <div className="rounded-md bg-[#EEF2F6] p-5 text-sm font-semibold text-slate-500">
              Aucune mission commune disponible pour cet assistant.
            </div>
          )}

          <div className="mt-6 rounded-xl bg-[#F8FAFC] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[18px] font-bold text-[#0F3A63]">Finalisation</h3>
              <span className="text-[12px] font-bold text-[#76B82A]">{submittedMissionsCount} / {missionReviews.length || 0}</span>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              La soumission finale n'est possible que lorsque toutes les missions ont déjà été transmises individuellement.
            </p>
            <button
              type="button"
              onClick={handleFinalizeReview}
              disabled={isSaving || isSubmitting || !missionReviews.length}
              className="mt-4 inline-flex rounded-md bg-[#003B63] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
            >
              {isSubmitting ? "Soumission…" : "Finaliser l'évaluation"}
            </button>
            {feedbackAnchor === "finalize" && feedbackMessage ? (
              <p className={`mt-2 text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
                {feedbackMessage}
              </p>
            ) : null}
          </div>
        </article>
      </section>

      {!feedbackAnchor && feedbackMessage ? (
        <p className={`text-right text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
          {feedbackMessage}
        </p>
      ) : null}
    </section>
  );
}

export default Evaluerassistants;
