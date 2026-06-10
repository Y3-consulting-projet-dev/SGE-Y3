import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  createManagerMemberMission,
  getManagerMemberEvaluation,
  saveManagerMemberMissionReviews,
  saveManagerMemberEvaluation,
  submitManagerMemberMissionReview,
  submitManagerMemberEvaluation,
} from "@/lib/managerOverview";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";

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

function getPageAverage(page) {
  const scores = (page?.themes || []).map((theme) => theme.score).filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getMissionReviewProgress(missionReview) {
  const criteria = missionReview?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function getMissionReviewAverage(missionReview) {
  const scores = (missionReview?.criteria || []).map((criterion) => criterion.score).filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getMissionGroups(criteria = []) {
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

function getMissionSectionProgress(section) {
  const criteria = (section?.groups || []).flatMap((group) => group.criteria || []);
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function getMissionSectionAverage(section) {
  const scores = (section?.groups || [])
    .flatMap((group) => group.criteria || [])
    .map((criterion) => criterion.score)
    .filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getRhRecipientRoleLabel(recipient) {
  const normalizedDepartment = String(recipient?.department || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalizedDepartment === "CAPITAL HUMAIN" ? "Assistante RH" : recipient?.department || "RH";
}

function hasRequiredSubmissionComment(sections = []) {
  return sections.length > 0 && sections.every((section) => String(section.comment || "").trim().length >= 3);
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
      .map((group) => ({ sectionTitle: section.title, pageTitle: group.pageTitle }))
  );
}

function MissionScoreRow({ criterion, onSelect }) {
  return (
    <div className="rounded-md border border-[#E3EAF3] bg-[#F8FBFF] p-3">
      <div className="mb-3">
        <p className="text-[13px] font-bold text-[#0F3A63]">
          {criterion.themeCode ? `${criterion.themeCode}. ` : ""}
          {criterion.label}
        </p>
        <p className="mt-1 text-[12px] leading-6 text-slate-600">{criterion.statement}</p>
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onSelect(score)}
            className={`inline-flex h-8 w-9 items-center justify-center rounded text-[12px] font-bold ${
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

function formatSubmittedAt(value) {
  if (!value) return "Date non renseignée";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatDateDisplay(value) {
  if (!value) return "";

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR").replace(/\//g, "-");
}

function formatMissionPeriod(period, startDate = "", endDate = "") {
  if (startDate && endDate) {
    return `Du ${formatDateDisplay(startDate)} au ${formatDateDisplay(endDate)}`;
  }

  const rangeMatch = String(period || "").match(/(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}).*?(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/);
  if (rangeMatch) {
    return `Du ${formatDateDisplay(rangeMatch[1])} au ${formatDateDisplay(rangeMatch[2])}`;
  }

  return period || "Période non renseignée";
}

function Evaluermonequipe({ member }) {
  const [reviewData, setReviewData] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeView, setActiveView] = useState("mission");
  const [activeSectionId, setActiveSectionId] = useState(1);
  const [pageIndexes, setPageIndexes] = useState({});
  const [activeMissionId, setActiveMissionId] = useState("");
  const [missionSectionIds, setMissionSectionIds] = useState({});
  const [missionPageIndexes, setMissionPageIndexes] = useState({});
  const [missionReviews, setMissionReviews] = useState([]);
  const [missionTitle, setMissionTitle] = useState("");
  const [missionStartDate, setMissionStartDate] = useState("");
  const [missionEndDate, setMissionEndDate] = useState("");
  const [savedComments, setSavedComments] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReview() {
      if (!member?.id) {
        setReviewData(null);
        setSections([]);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getManagerMemberEvaluation(member.id);

        if (cancelled) return;

        setReviewData(response);
        setSections(response.review.sections || []);
        setMissionReviews(response.mission_reviews || []);
        setMissionTitle("");
        setMissionStartDate("");
        setMissionEndDate("");
        setActiveSectionId(Number(response.review.activeSectionId || response.review.sections?.[0]?.id || 1));
        setActiveMissionId((current) => current || response.submitted_missions?.[0]?.id || response.mission_reviews?.[0]?.id || "");
        setMissionSectionIds({});
        setMissionPageIndexes({});
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
          setErrorMessage(error.message || "Chargement de l'évaluation manager impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadReview();

    return () => {
      cancelled = true;
    };
  }, [member?.id]);

  const activeSection = sections.find((section) => Number(section.id) === Number(activeSectionId)) || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const shouldShowSourceLabel = reviewData?.member?.department === "AUDIT & EXPERTISE COMPTABLE";
  const activePageSourceBadgeLabel = getSourceBadgeLabel(activePage);
  const completedSections = sections.filter((section) => getSectionProgress(section) === 100).length;
  const globalProgress = Math.round(
    sections.reduce((total, section) => total + getSectionProgress(section), 0) / (sections.length || 1)
  );
  const activePageAverage = useMemo(() => getPageAverage(activePage), [activePage]);
  const rhRecipients = reviewData?.submitted_to || [];
  const selfEvaluation = reviewData?.self_evaluation || {};
  const evaluationDepartment = reviewData?.review_context?.evaluationDepartment || reviewData?.member?.department || "";
  const receivedGlobalScores = reviewData?.received_global_scores || [];
  const submittedMissions = reviewData?.submitted_missions || [];
  const pendingAssignedMissions = missionReviews.filter(
    (missionReview) =>
      missionReview.origin === "manager-assigned" && !submittedMissions.some((mission) => mission.id === missionReview.id)
  );
  const activeSubmittedMission = submittedMissions.find((mission) => mission.id === activeMissionId) || null;
  const activeMissionReview = missionReviews.find((mission) => mission.id === activeMissionId) || null;
  const activeMission =
    activeSubmittedMission ||
    (activeMissionReview
      ? {
          id: activeMissionReview.id,
          title: activeMissionReview.title,
          period: activeMissionReview.period,
          department: activeMissionReview.department,
          submissions: [],
        }
      : submittedMissions[0] || null);
  const activeMissionGroups = useMemo(() => getMissionGroups(activeMissionReview?.criteria || []), [activeMissionReview]);
  const missionSections = useMemo(() => getMissionSections(activeMissionGroups), [activeMissionGroups]);
  const activeMissionSectionId = missionSectionIds[activeMissionId] || missionSections[0]?.id || "";
  const activeMissionSection =
    missionSections.find((section) => section.id === activeMissionSectionId) || missionSections[0] || null;
  const activeMissionSectionIndex = missionSections.findIndex((section) => section.id === activeMissionSection?.id);
  const activeMissionPageIndex = Math.min(
    missionPageIndexes[activeMissionId] || 0,
    Math.max((activeMissionSection?.groups?.length || 1) - 1, 0)
  );
  const activeMissionGroup = activeMissionSection?.groups?.[activeMissionPageIndex] || activeMissionSection?.groups?.[0] || null;
  const activeMissionAverage = useMemo(() => getMissionReviewAverage(activeMissionReview), [activeMissionReview]);
  const hasLowScoreOnActiveMissionPage = (activeMissionGroup?.criteria || []).some(
    (criterion) => typeof criterion.score === "number" && criterion.score < 3
  );
  const hasRequiredMissionPageJustification =
    !hasLowScoreOnActiveMissionPage || String(activeMissionGroup?.pageComment || "").trim().length >= 3;
  const hasLowScoreOnActivePage = (activePage?.themes || []).some(
    (theme) => typeof theme.score === "number" && theme.score < 3
  );
  const hasRequiredJustification = !hasLowScoreOnActivePage || String(activePage?.comment || "").trim().length >= 3;

  useEffect(() => {
    if (!activeMissionReview?.id || !missionSections.length) return;

    const timeoutId = setTimeout(() => {
      setMissionSectionIds((current) => ({
        ...current,
        [activeMissionReview.id]: current[activeMissionReview.id] || missionSections[0].id,
      }));
      setMissionPageIndexes((current) => ({
        ...current,
        [activeMissionReview.id]: current[activeMissionReview.id] || 0,
      }));
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [activeMissionReview?.id, missionSections]);

  function syncSections(updater) {
    setSections((currentSections) => {
      const nextSections = typeof updater === "function" ? updater(currentSections) : updater;

      return nextSections.map((section) => {
        const progress = getSectionProgress(section);
        return {
          ...section,
          status: progress === 0 ? "À faire" : progress === 100 ? "Complétée" : "En cours",
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
                  themes: (page.themes || []).map((theme) =>
                    theme.theme_id === themeId ? { ...theme, score } : theme
                  ),
                }
          ),
        };
      })
    );
  }

  function updateComment(comment) {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(activeSectionId)) return section;

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
        if (Number(section.id) !== Number(activeSectionId)) return section;

        return {
          ...section,
          pages: (section.pages || []).map((page, pageIndex) =>
            pageIndex !== activePageIndex
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

  async function persistSections(nextSections = sections, successMessage = "Évaluation manager enregistrée.") {
    if (!member?.id) return null;

    try {
      setIsSaving(true);
      setFeedbackMessage("");
      const response = await saveManagerMemberEvaluation(member.id, {
        sections: nextSections,
      });

      setReviewData(response);
      setSections(response.review.sections || []);
      setMissionReviews(response.mission_reviews || []);
      setPageIndexes((current) => clampPageIndexes(response.review.sections || [], current));
      setSavedComments(
        Object.fromEntries(
          (response.review.sections || [])
            .filter((section) => section.comment?.trim())
            .map((section) => [section.id, section.comment.trim()])
        )
      );
      setFeedbackTone("success");
      setFeedbackMessage(response.message || successMessage);
      return response;
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Sauvegarde impossible.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  function updateMissionCriterionScore(criterionId, score) {
    setMissionReviews((currentMissionReviews) =>
      currentMissionReviews.map((missionReview) =>
        missionReview.id !== activeMissionId
          ? missionReview
          : {
              ...missionReview,
              status: missionReview.status === "Soumise à la RH" ? missionReview.status : "En cours",
              criteria: (missionReview.criteria || []).map((criterion) =>
                criterion.id === criterionId ? { ...criterion, score } : criterion
              ),
            }
      )
    );
    setFeedbackMessage("");
  }

  function updateMissionReviewComment(comment) {
    setMissionReviews((currentMissionReviews) =>
      currentMissionReviews.map((missionReview) =>
        missionReview.id !== activeMissionId
          ? missionReview
          : {
              ...missionReview,
              comment,
            }
      )
    );
    setFeedbackMessage("");
  }

  function updateMissionSectionComment(comment) {
    setMissionReviews((currentMissionReviews) =>
      currentMissionReviews.map((missionReview) =>
        missionReview.id !== activeMissionId
          ? missionReview
          : {
              ...missionReview,
              criteria: (missionReview.criteria || []).map((criterion) =>
                criterion.sectionTitle === activeMissionSection?.title ? { ...criterion, sectionComment: comment } : criterion
              ),
            }
      )
    );
    setFeedbackMessage("");
  }

  function updateMissionPageComment(comment) {
    setMissionReviews((currentMissionReviews) =>
      currentMissionReviews.map((missionReview) =>
        missionReview.id !== activeMissionId
          ? missionReview
          : {
              ...missionReview,
              criteria: (missionReview.criteria || []).map((criterion) =>
                criterion.sectionTitle === activeMissionGroup?.sectionTitle && criterion.pageTitle === activeMissionGroup?.pageTitle
                  ? { ...criterion, pageComment: comment }
                  : criterion
              ),
            }
      )
    );
    setFeedbackMessage("");
  }

  async function persistMissionReviews(nextMissionReviews = missionReviews, successMessage = "Évaluation manager par mission enregistrée.") {
    if (!member?.id) return null;

    try {
      setIsSaving(true);
      setFeedbackMessage("");
      const response = await saveManagerMemberMissionReviews(member.id, {
        missionReviews: nextMissionReviews,
      });

      setReviewData(response);
      setSections(response.review.sections || []);
      setMissionReviews(response.mission_reviews || []);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || successMessage);
      return response;
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Sauvegarde de la mission impossible.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMission() {
    if (!member?.id) return;

    const title = missionTitle.trim();

    if (!title) {
      setFeedbackTone("error");
      setFeedbackMessage("Renseignez le titre de la mission.");
      return;
    }

    if (!missionStartDate || !missionEndDate) {
      setFeedbackTone("error");
      setFeedbackMessage("Renseignez la date de début et la date de fin de la mission.");
      return;
    }

    if (missionEndDate < missionStartDate) {
      setFeedbackTone("error");
      setFeedbackMessage("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }

    try {
      setIsSaving(true);
      setFeedbackMessage("");
      const response = await createManagerMemberMission(member.id, {
        title,
        period: formatMissionPeriod("", missionStartDate, missionEndDate),
      });

      setReviewData(response);
      setSections(response.review.sections || []);
      setMissionReviews(response.mission_reviews || []);
      const addedMission = response.mission_reviews?.[response.mission_reviews.length - 1] || null;
      if (addedMission?.id) {
        setActiveMissionId(addedMission.id);
        const addedMissionSections = getMissionSections(getMissionGroups(addedMission.criteria || []));
        setMissionSectionIds((current) => ({
          ...current,
          [addedMission.id]: addedMissionSections[0]?.id || "",
        }));
        setMissionPageIndexes((current) => ({
          ...current,
          [addedMission.id]: 0,
        }));
      }
      setMissionTitle("");
      setMissionStartDate("");
      setMissionEndDate("");
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Mission ajoutée pour ce membre.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Ajout de la mission impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitMissionReview() {
    if (!member?.id || !activeMissionReview?.id) return;

    const hasIncompleteCriterion = (activeMissionReview.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      setFeedbackTone("error");
      setFeedbackMessage("Toutes les questions de la mission doivent être renseignées avant soumission à la RH.");
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

    const savedMissionReview = await persistMissionReviews(missionReviews, "Évaluation manager par mission prête pour soumission.");

    if (!savedMissionReview) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await submitManagerMemberMissionReview(member.id, activeMissionReview.id);
      setReviewData(response);
      setSections(response.review.sections || []);
      setMissionReviews(response.mission_reviews || []);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Mission soumise à la RH.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission de la mission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function goToMissionStep(direction) {
    if (!activeMissionReview || !activeMissionSection) return;

    const nextPageIndex = activeMissionPageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < (activeMissionSection.groups?.length || 0)) {
      setMissionPageIndexes((current) => ({
        ...current,
        [activeMissionReview.id]: nextPageIndex,
      }));
      return;
    }

    const nextSection = missionSections[activeMissionSectionIndex + direction];
    if (!nextSection) return;

    setMissionSectionIds((current) => ({
      ...current,
      [activeMissionReview.id]: nextSection.id,
    }));
    setMissionPageIndexes((current) => ({
      ...current,
      [activeMissionReview.id]: direction > 0 ? 0 : Math.max((nextSection.groups?.length || 1) - 1, 0),
    }));
  }

  function handleMissionNextStep() {
    if (!hasRequiredMissionPageJustification) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour toute note inférieure à 3 sur ce titre.");
      return;
    }

    goToMissionStep(1);
  }

  function goToStep(direction) {
    if (!activeSection) return;

    const nextPageIndex = activePageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < (activeSection.pages?.length || 0)) {
      setPageIndexes((current) => ({
        ...current,
        [activeSection.id]: nextPageIndex,
      }));
      return;
    }

    const sectionIndex = sections.findIndex((section) => Number(section.id) === Number(activeSectionId));
    const nextSection = sections[sectionIndex + direction];
    if (!nextSection) return;

    setActiveSectionId(Number(nextSection.id));
    setPageIndexes((current) => ({
      ...current,
      [nextSection.id]: direction > 0 ? 0 : Math.max((nextSection.pages?.length || 1) - 1, 0),
    }));
  }

  async function handleSaveAndContinue() {
    if (!hasRequiredJustification) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour toute note inférieure à 3.");
      return;
    }

    await persistSections(sections, "Évaluation manager enregistrée.");
    goToStep(1);
  }

  async function handleSubmit() {
    if (!hasRequiredSubmissionComment(sections)) {
      setFeedbackTone("error");
      setFeedbackMessage("Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant soumission.");
      return;
    }

    if (!hasRequiredJustification) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour toute note inférieure à 3.");
      return;
    }

    const savedReview = await persistSections(sections, "Évaluation manager prête pour soumission.");

    if (!savedReview) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await submitManagerMemberEvaluation(member.id);
      setReviewData(response);
      setSections(response.review.sections || []);
      setMissionReviews(response.mission_reviews || []);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Évaluation soumise à la RH.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'évaluation manager...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!reviewData || !sections.length || !activeSection || !activePage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucune évaluation disponible pour ce membre.</section>;
  }

  const isLastStep =
    Number(activeSectionId) === Number(sections[sections.length - 1]?.id) &&
    activePageIndex === (activeSection.pages?.length || 1) - 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">{reviewData.review.cycle_label || "Cycle 2025-2026"}</p>
          <h3 className="text-2xl font-black text-[#0F3A63]">
            {reviewData.member.name} ({reviewData.member.grade})
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Département du membre : {reviewData.member.department} | Matrice utilisée : {evaluationDepartment}
          </p>
        </div>
        <div className="rounded-xl bg-[#F3F8EC] px-4 py-3 text-sm font-semibold text-[#4E8B1B]">
          {reviewData.review.status}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveView("mission")}
          className={`rounded-xl border px-5 py-4 text-left shadow-sm transition ${
            activeView === "mission"
              ? "border-[#7FB1D6] bg-[#F6FAFD]"
              : "border-[#D9E3EE] bg-white hover:bg-[#F8FBFE]"
          }`}
        >
          <div className="mb-3 inline-flex rounded-full bg-[#0B4C7A] px-3 py-1 text-[11px] font-bold uppercase text-white">
            Parcours 1
          </div>
          <h2 className="text-lg font-black text-[#0F3A63]">Évaluations par mission</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {submittedMissions.length} mission(s) soumise(s)
          </p>
          <p className="mt-2 text-xs font-semibold text-[#0B4C7A]">
            Consultez les scores finaux déjà transmis pour chaque mission.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("global")}
          className={`hidden rounded-xl border px-5 py-4 text-left shadow-sm transition ${
            activeView === "global"
              ? "border-[#B7D39E] bg-[#FBFEF7]"
              : "border-[#D9E3EE] bg-white hover:bg-[#FCFEF8]"
          }`}
        >
          <div className="mb-3 inline-flex rounded-full bg-[#DCECCB] px-3 py-1 text-[11px] font-bold uppercase text-[#4E8B1B]">
            Parcours 2
          </div>
          <h2 className="text-lg font-black text-[#0F3A63]">Évaluation globale du cycle</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {reviewData.review.cycle_label || "Cycle 2025-2026"} - {globalProgress}%
          </p>
          <p className="mt-2 text-xs font-semibold text-[#4E8B1B]">
            Notez la matrice globale du membre puis soumettez à la RH.
          </p>
        </button>
      </section>

      {feedbackMessage ? (
        <div
          className={`rounded-md px-4 py-3 text-sm font-semibold ${
            feedbackTone === "error" ? "bg-[#FDEBEC] text-[#B93840]" : "bg-[#DCECCB] text-[#184D2E]"
          }`}
        >
          {feedbackMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.35fr]">
        {activeView === "mission" ? (
          <>
            <article className="space-y-4">
              <div className="rounded-md border border-[#D9E3EE] bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <p className="text-sm font-bold text-[#0B4C7A]">Nouvelle mission pour ce membre</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Renseignez le titre, la date de début et la date de fin. Le membre la recevra dans son auto-évaluation par mission.
                  </p>
                </div>
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
                    <label className="mb-1 block text-[12px] font-bold text-[#0F3A63]">Date de début</label>
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
                <button
                  type="button"
                  onClick={handleAddMission}
                  disabled={isSaving || isSubmitting}
                  className="inline-flex rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                >
                  {isSaving ? "Ajout…" : "Ajouter la mission"}
                </button>
              </div>
              </div>

              {pendingAssignedMissions.length ? (
                <div className="rounded-md border border-[#D9E3EE] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#0B4C7A]">Missions en attente de retour</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Ces missions ont été ajoutées et attendent encore la soumission du membre.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                      {pendingAssignedMissions.length} mission(s)
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pendingAssignedMissions.map((mission) => (
                      <button key={mission.id} type="button" onClick={() => setActiveMissionId(mission.id)} className="w-full rounded-md border border-slate-100 bg-[#F8FAFC] p-3 text-left transition hover:bg-white">
                        <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{formatMissionPeriod(mission.period)}</p>
                        <p className="mt-1 text-xs font-bold text-[#0F3A63]">{mission.status || "A démarrer"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border border-[#BFD7EA] bg-[#F8FBFE] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0B4C7A]">Missions soumises</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Choisissez une mission pour voir les scores finaux soumis au manager.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                    {submittedMissions.length} mission(s)
                  </span>
                </div>
                {submittedMissions.length ? (
                  <div className="space-y-3">
                    {submittedMissions.map((mission) => (
                      <button
                        key={mission.id}
                        type="button"
                        onClick={() => {
                          setActiveMissionId(mission.id);
                          const selectedMissionReview = missionReviews.find((item) => item.id === mission.id);
                          const selectedMissionSections = getMissionSections(getMissionGroups(selectedMissionReview?.criteria || []));
                          setMissionSectionIds((current) => ({
                            ...current,
                            [mission.id]: current[mission.id] || selectedMissionSections[0]?.id || "",
                          }));
                          setMissionPageIndexes((current) => ({
                            ...current,
                            [mission.id]: current[mission.id] || 0,
                          }));
                        }}
                        className={`w-full rounded-md border p-3 text-left transition ${
                          activeMission?.id === mission.id ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{formatMissionPeriod(mission.period)}</p>
                        <p className="mt-1 text-xs font-bold text-[#0F3A63]">{mission.department}</p>
                        <p className={`mt-2 text-xs font-bold ${getProgressToneClass(getMissionReviewProgress(missionReviews.find((item) => item.id === mission.id)))}`}>
                          {getMissionReviewProgress(missionReviews.find((item) => item.id === mission.id))}%
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Aucune mission soumise à ce manager pour le moment.</p>
                )}
              </div>
            </article>

            <article className="space-y-4">
              {activeMission ? (
                <section className="rounded-md border border-[#BFD7EA] bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="mb-2 inline-flex rounded-full bg-[#E7F1F8] px-3 py-1 text-[11px] font-bold uppercase text-[#0B4C7A]">
                        Évaluation par mission
                      </div>
                      <h4 className="text-xl font-black text-[#0F3A63]">{activeMission.title}</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {formatMissionPeriod(activeMission.period)} - {activeMission.department}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {activeMission.submissions.map((submission, index) => (
                      <div key={`${submission.source}-${submission.evaluatorName}-${index}`} className="rounded-md bg-[#F8FBFE] p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#0F3A63]">{submission.evaluatorName}</p>
                            <p className="text-xs text-slate-500">{submission.evaluatorGrade}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-extrabold text-[#76B82A]">{submission.finalScore ?? "--"} / 5</p>
                            <p className="text-xs text-slate-500">{formatSubmittedAt(submission.submittedAt)}</p>
                          </div>
                        </div>
                        {submission.comment ? (
                          <div className="mt-3 rounded-md bg-white px-3 py-3">
                            <p className="text-xs font-bold uppercase text-slate-500">Commentaire général</p>
                            <p className="mt-1 text-sm text-slate-600">{submission.comment}</p>
                          </div>
                        ) : null}
                        {(submission.sectionComments || []).length ? (
                          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                            {(submission.sectionComments || []).map((section) => (
                              <div key={`${submission.evaluatorName}-${section.sectionId}`} className="rounded-md bg-white p-3">
                                <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">{section.comment}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {(submission.titleJustifications || []).length ? (
                          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                            {(submission.titleJustifications || []).map((item) => (
                              <div key={`${submission.evaluatorName}-${item.pageId}`} className="rounded-md bg-white p-3">
                                <p className="text-xs font-bold text-[#0F3A63]">{item.sectionTitle}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">{item.pageTitle}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">{item.comment}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {activeMissionReview ? (
                    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#4E8B1B]">Évaluation manager sur la mission</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Moyenne : {activeMissionAverage} / 5 - Progression : {getMissionReviewProgress(activeMissionReview)}%
                          </p>
                        </div>
                        <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                          {activeMissionReview.status || "À démarrer"}
                        </span>
                      </div>

                      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {missionSections.map((section) => {
                          const progress = getMissionSectionProgress(section);
                          const isActive = section.id === activeMissionSection?.id;

                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => {
                                setMissionSectionIds((current) => ({
                                  ...current,
                                  [activeMissionReview.id]: section.id,
                                }));
                                setMissionPageIndexes((current) => ({
                                  ...current,
                                  [activeMissionReview.id]: 0,
                                }));
                              }}
                              className={`rounded-md border px-3 py-3 text-left text-white transition ${
                                isActive
                                  ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]"
                                  : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-[13px] font-bold">{section.title}</h2>
                                {progress === 100 ? <Check size={14} className="text-white" /> : null}
                              </div>
                              <p className="text-[12px] font-semibold">{section.groups?.length || 0} titre(s)</p>
                              <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                                <div className={`h-1.5 rounded-full ${getProgressBarClass(progress)}`} style={{ width: `${clampProgress(progress)}%` }} />
                              </div>
                              <p className={`mt-1.5 text-[10px] font-semibold ${getProgressToneClass(progress)}`}>{progress}%</p>
                            </button>
                          );
                        })}
                      </section>

                      <section className="rounded-md bg-[#F8FAFC] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-semibold text-slate-500">Pagination dans la mission</p>
                            <h4 className="text-[18px] font-bold text-[#0F3A63]">{activeMissionSection?.title}</h4>
                          </div>
                          <span className="text-[12px] font-semibold text-[#0F3A63]">
                            Titre {activeMissionPageIndex + 1} / {activeMissionSection?.groups?.length || 1}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(activeMissionSection?.groups || []).map((group, index) => {
                            const isActive = index === activeMissionPageIndex;
                            const progress = getMissionReviewProgress({ criteria: group.criteria });

                            return (
                              <button
                                key={group.key}
                                type="button"
                                onClick={() =>
                                  setMissionPageIndexes((current) => ({
                                    ...current,
                                    [activeMissionReview.id]: index,
                                  }))
                                }
                                className={`rounded-md border px-3 py-2 text-left transition ${
                                  isActive
                                    ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]"
                                    : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <p className="text-[11px] font-bold">Titre {index + 1}</p>
                                <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                                {shouldShowSourceLabel && group.sourceLabel && group.sourceSheet !== "TRONC COMMUN" ? (
                                  <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                                    {group.sourceLabel}
                                  </span>
                                ) : null}
                                <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(progress)}`}>{progress}%</p>
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      <div className="rounded-md border border-[#D9E3EE] bg-[#FCFEF8] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-[#4E8B1B]">Scores finaux par section</p>
                          <span className="text-xs font-semibold text-slate-500">Mission sélectionnée</span>
                        </div>
                        <div className="space-y-2">
                          {missionSections.map((section) => (
                            <div key={section.id} className="flex items-center justify-between text-sm font-semibold text-[#0F3A63]">
                              <span>{section.title}</span>
                              <span className="text-[#76B82A]">{getMissionSectionAverage(section)} / 5</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {activeMissionGroup ? (
                        <div className="rounded-md border border-[#D9E3EE] bg-white p-4">
                          <div className="mb-3">
                            <p className="text-[11px] font-bold uppercase text-slate-500">{activeMissionGroup.sectionTitle}</p>
                            <p className="mt-1 text-[15px] font-bold text-[#0F3A63]">{activeMissionGroup.pageTitle}</p>
                            {shouldShowSourceLabel && activeMissionGroup.sourceLabel && activeMissionGroup.sourceSheet !== "TRONC COMMUN" ? (
                              <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[11px] font-semibold text-[#0F3A63]">
                                {activeMissionGroup.sourceLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="space-y-3">
                            {activeMissionGroup.criteria.map((criterion) => (
                              <MissionScoreRow
                                key={criterion.id}
                                criterion={criterion}
                                onSelect={(score) => updateMissionCriterionScore(criterion.id, score)}
                              />
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
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => goToMissionStep(-1)}
                          disabled={activeMissionSectionIndex === 0 && activeMissionPageIndex === 0}
                          className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronLeft size={14} />
                          Précédent
                        </button>

                        <button
                          type="button"
                          onClick={handleMissionNextStep}
                          disabled={
                            activeMissionSectionIndex === missionSections.length - 1 &&
                            activeMissionPageIndex === (activeMissionSection?.groups?.length || 1) - 1
                          }
                          className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                        >
                          Titre suivant
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      <div>
                        <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire manager sur la mission</p>
                        <textarea
                          rows={4}
                          value={activeMissionReview.comment || ""}
                          onChange={(event) => updateMissionReviewComment(event.target.value)}
                          placeholder="Analyse manager, écarts constates, faits marquants..."
                          className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => persistMissionReviews(missionReviews)}
                          disabled={isSaving || isSubmitting || activeMissionReview.status === "Soumise à la RH"}
                          className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 disabled:opacity-70"
                        >
                          {isSaving ? "Sauvegarde..." : "Sauvegarder la mission"}
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitMissionReview}
                          disabled={isSaving || isSubmitting || activeMissionReview.status === "Soumise à la RH"}
                          className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                        >
                          {isSubmitting ? "Soumission..." : "Soumettre la mission à la RH"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : (
                <section className="rounded-md border border-[#BFD7EA] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Aucune mission sélectionnée.</p>
                </section>
              )}
            </article>
          </>
        ) : (
          <>
            <article className="space-y-4">
              <div className="rounded-md border border-[#D9E3EE] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[#76B82A]">Évaluation globale reçue</p>
                  <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                    {selfEvaluation.overallAverage ?? "--"} / 5
                  </span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-évaluation du membre</p>
                <div className="mt-3 space-y-2">
                  {(selfEvaluation.sectionScores || []).map((section) => (
                    <div key={section.sectionId} className="flex items-center justify-between text-sm font-semibold text-[#0F3A63]">
                      <span>{section.title}</span>
                      <span className="text-[#76B82A]">{section.score ?? "--"} / 5</span>
                    </div>
                  ))}
                </div>
                {(selfEvaluation.sectionComments || []).length ? (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    {(selfEvaluation.sectionComments || []).map((section) => (
                      <div key={section.sectionId} className="rounded-md bg-[#F8FAFC] p-3">
                        <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{section.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {(selfEvaluation.titleJustifications || []).length ? (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    {(selfEvaluation.titleJustifications || []).map((item) => (
                      <div key={`${item.sectionId}-${item.pageId}`} className="rounded-md bg-[#F8FAFC] p-3">
                        <p className="text-xs font-bold text-[#0F3A63]">{item.sectionTitle}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{item.pageTitle}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{item.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="mt-4 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-500">
                  Statut : {selfEvaluation.status || "En attente"} | Moyenne : {selfEvaluation.overallAverage ?? "--"} / 5
                </p>
                {(selfEvaluation.chiefComments || []).length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#0F3A63]">
                      Commentaire anonyme reçu
                    </p>
                    {(selfEvaluation.chiefComments || []).map((item, index) => (
                      <div key={index} className="rounded-md bg-[#F4FAED] p-3 ring-1 ring-[#C3DFAA]">
                        <p className="text-[12px] font-semibold text-slate-700">{item.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border border-[#D9E3EE] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[#76B82A]">Scores globaux reçus</p>
                  <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                    {receivedGlobalScores.length} score(s)
                  </span>
                </div>
                {receivedGlobalScores.length ? (
                  <div className="space-y-2">
                    {receivedGlobalScores.map((item, index) => (
                      <div key={`${item.source}-${item.evaluatorName}-${index}`} className="rounded-md bg-[#F8FAFC] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#0F3A63]">{item.evaluatorName}</p>
                            <p className="text-xs text-slate-500">{item.evaluatorGrade}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-extrabold text-[#76B82A]">{item.finalScore ?? "--"} / 5</p>
                            <p className="text-xs text-slate-500">{formatSubmittedAt(item.submittedAt)}</p>
                          </div>
                        </div>
                        {(item.sectionComments || []).length ? (
                          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                            {item.sectionComments.map((section) => (
                              <div key={`${item.evaluatorName}-${section.sectionId}`} className="rounded-md bg-white p-3">
                                <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">{section.comment}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {(item.titleJustifications || []).length ? (
                          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                            {item.titleJustifications.map((title) => (
                              <div key={`${item.evaluatorName}-${title.pageId}`} className="rounded-md bg-white p-3">
                                <p className="text-xs font-bold text-[#0F3A63]">{title.sectionTitle}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">{title.pageTitle}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">{title.comment}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Aucun score global encore soumis à votre niveau.</p>
                )}
              </div>

              <div className="rounded-md border border-[#DCE7D0] bg-[#FCFEF8] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#4E8B1B]">Sections globales</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {completedSections} / {sections.length} complétée(s)
                    </p>
                  </div>
                  <span className={`rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold ${getProgressToneClass(globalProgress)}`}>{globalProgress}%</span>
                </div>

                <div className="space-y-3">
                  {sections.map((section) => {
                    const progress = getSectionProgress(section);
                    const isActive = Number(section.id) === Number(activeSectionId);

                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSectionId(Number(section.id))}
                        className={`w-full rounded-md border p-3 text-left transition ${
                          isActive ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-extrabold text-[#0F3A63]">{section.title}</p>
                          {progress === 100 ? <Check size={14} className="text-[#76B82A]" /> : null}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{section.pages?.length || 0} titre(s)</p>
                        <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                          <div className={`h-1.5 rounded-full ${getProgressBarClass(progress)}`} style={{ width: `${clampProgress(progress)}%` }} />
                        </div>
                        <p className={`mt-1 text-xs font-bold ${getProgressToneClass(progress)}`}>{progress}% complétée</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-[#D9E3EE] bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-[#76B82A]">Destinataires RH</p>
                <div className="mt-3 space-y-2">
                  {rhRecipients.map((recipient) => (
                    <p key={recipient.id} className="text-sm font-semibold text-[#0F3A63]">
                      {recipient.name} ({getRhRecipientRoleLabel(recipient)})
                    </p>
                  ))}
                </div>
              </div>
            </article>

            <article className="space-y-4">
              <section className="rounded-md border border-[#DCE7D0] bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-[#EFF7E4] px-3 py-1 text-[11px] font-bold uppercase text-[#4E8B1B]">
                  Évaluation globale du cycle
                </div>
                <h4 className="text-2xl font-black text-[#0F3A63]">{activeSection.title}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">Score moyen du titre : {activePageAverage} / 5</p>
              </div>
              <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                {reviewData.review.last_saved_at ? "Enregistrée" : "Non disponible"}
              </span>
            </div>

            <section className="mb-4 rounded-md bg-[#F8FAFC] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-slate-500">Navigation dans la grille globale</p>
                  <h4 className="text-[18px] font-bold text-[#0F3A63]">{activeSection.title}</h4>
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
                      <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(progress)}`}>{progress}%</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="space-y-3.5">
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">{activeSection.title}</p>
                <p className="mt-1 text-[15px] font-bold text-[#0F3A63]">{activePage.title}</p>
                {shouldShowSourceLabel && activePageSourceBadgeLabel && activePage.source_sheet !== "TRONC COMMUN" ? (
                  <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[11px] font-semibold text-[#0F3A63]">
                    {activePageSourceBadgeLabel}
                  </span>
                ) : null}
              </div>

              {(activePage.themes || []).map((theme) => (
                <ScoreRow key={theme.theme_id} theme={theme} onSelect={(score) => updateScore(theme.theme_id, score)} />
              ))}
            </div>

            {hasLowScoreOnActivePage ? (
              <div className="mt-4 rounded-md bg-[#FDEBEC] px-3 py-2 text-[11px] font-semibold text-[#B93840]">
                Une note inférieure à 3 a été détectée. Merci de justifier cet écart.
              </div>
            ) : null}

            {hasLowScoreOnActivePage ? (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Justification du titre</p>
                <textarea
                  rows={3}
                  value={activePage?.comment || ""}
                  onChange={(event) => updatePageComment(event.target.value)}
                  placeholder="Expliquez la raison des notes inférieures à 3 pour ce titre..."
                  className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                />
              </div>
            ) : null}

            <div className="mt-4">
              <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">
                Commentaire de section
              </p>
              <textarea
                rows={4}
                value={activeSection.comment || ""}
                onChange={(event) => updateComment(event.target.value)}
                placeholder={
                  hasLowScoreOnActivePage
                    ? "Expliquez la raison globale des notes inférieures à 3 dans cette section..."
                    : "Faits marquants, écarts constates, recommandations pour la section..."
                }
                className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
              />
            </div>

            {savedComments[activeSection.id] ? (
              <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2">
                <p className="text-[10px] font-bold text-[#5A8A3A]">Commentaire sauvegarde</p>
                <p className="mt-1 text-[11px] font-semibold text-[#0F3A63]">{savedComments[activeSection.id]}</p>
              </div>
            ) : null}

            <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
              Toutes les questions doivent être renseignées avant soumission à la RH.
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToStep(-1)}
                disabled={Number(activeSectionId) === Number(sections[0]?.id) && activePageIndex === 0}
                className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={14} />
                Précédent
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
                  <>
                    <button
                      type="button"
                      onClick={() => persistSections(sections)}
                      disabled={isSaving || isSubmitting}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 disabled:opacity-70"
                    >
                      {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSaving || isSubmitting || reviewData.review.status === "Soumis à la RH"}
                      className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      {isSubmitting ? "Soumission..." : "Soumettre à la RH"}
                    </button>
                  </>
                )}
              </div>
            </div>
              </section>
            </article>
          </>
        )}
      </section>
    </div>
  );
}

export default Evaluermonequipe;


