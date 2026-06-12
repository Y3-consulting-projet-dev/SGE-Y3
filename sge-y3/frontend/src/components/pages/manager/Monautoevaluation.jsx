import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  createManagerMissionEvaluation,
  getManagerSelfEvaluation,
  saveManagerSelfEvaluation,
  submitManagerMissionEvaluation,
  submitManagerSelfEvaluation,
} from "@/lib/managerOverview";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";

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

function getMissionProgress(mission) {
  const criteria = mission?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function getMissionAverage(criteria = []) {
  const scores = criteria.map((criterion) => criterion.score).filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getMissionFinalScore(missions = []) {
  const missionScores = missions
    .map((mission) => {
      const score = getMissionAverage(mission.criteria || []);
      return score === "--" ? null : Number(score);
    })
    .filter((score) => typeof score === "number");

  if (!missionScores.length) return "--";
  return (missionScores.reduce((total, score) => total + score, 0) / missionScores.length).toFixed(1);
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

function getSourceBadgeLabel(page) {
  if (page?.source_label) return page.source_label;
  if (page?.source_sheet === "AUDIT") return "Audit";
  if (page?.source_sheet === "EXPERTISE COMPTABLE") return "Expertise comptable";
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

function getRhRecipientRoleLabel(recipient) {
  const normalizedDepartment = String(recipient?.department || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalizedDepartment === "CAPITAL HUMAIN" ? "Assistante RH" : recipient?.department || "RH";
}

function isRhValidationRecipient(recipient) {
  const normalizedDepartment = String(recipient?.department || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalizedDepartment === "RH";
}

function getRecipientOptionValue(recipient) {
  return String(recipient?.id || recipient?.user_id || "");
}

function getMissionEvaluatingRecipients(mission) {
  return (mission?.recipients || []).filter((recipient) => recipient?.canEvaluate !== false && recipient?.can_evaluate !== false);
}

function hasRequiredSubmissionComment(sections = []) {
  return sections.length > 0 && sections.every((section) => String(section.comment || "").trim().length >= 3);
}

function normalizeSearchValue(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function ScoreSelector({ selected, onSelect }) {
  return (
    <div className="space-y-2">
      <div className="flex overflow-hidden rounded-md border border-slate-200">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onSelect(score)}
            className={`h-8 w-10 border-r border-slate-200 text-xs font-semibold last:border-r-0 ${
              score === selected ? "bg-[#003B63] text-white" : "bg-slate-100 text-[#0F3A63]"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-[3px] w-28 rounded-full bg-slate-300">
          <div className="h-[3px] rounded-full bg-[#79B742]" style={{ width: `${selected ? selected * 20 : 0}%` }} />
        </div>
        <span className={`text-xs font-semibold ${selected ? "text-[#79B742]" : "text-slate-400"}`}>
          {selected ? `${selected * 20}%` : "--%"}
        </span>
      </div>
    </div>
  );
}

function SectionBadge({ progress }) {
  if (progress === 100) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#DFECD4] px-3 py-1 text-[11px] font-semibold text-[#79B742]">
        <CheckCircle2 size={12} />
        Complète
      </span>
    );
  }

  if (progress > 0) {
    return <span className="rounded-full bg-[#F6D4D4] px-3 py-1 text-xs font-semibold text-[#DF4C4C]">En cours</span>;
  }

  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">À faire</span>;
}

function Monautoevaluation() {
  const [evaluationData, setEvaluationData] = useState(null);
  const [activeView, setActiveView] = useState("missions");
  const [activeMissionView, setActiveMissionView] = useState("synthese");
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  const [isMissionPickerOpen, setIsMissionPickerOpen] = useState(false);
  const [sections, setSections] = useState([]);
  const [missionEvaluations, setMissionEvaluations] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState("");
  const [missionSectionIds, setMissionSectionIds] = useState({});
  const [missionPageIndexes, setMissionPageIndexes] = useState({});
  const [missionTitle, setMissionTitle] = useState("");
  const [missionStartDate, setMissionStartDate] = useState("");
  const [missionEndDate, setMissionEndDate] = useState("");
  const [selectedAssociateValues, setSelectedAssociateValues] = useState([]);
  const [selectedAssociateValue, setSelectedAssociateValue] = useState("");
  const [activeSectionId, setActiveSectionId] = useState(1);
  const [pageIndexes, setPageIndexes] = useState({});
  const [savedComments, setSavedComments] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const missionPickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getManagerSelfEvaluation();

        if (cancelled) return;

        setEvaluationData(response);
        setSections(response.evaluation.sections || []);
        setMissionEvaluations(response.mission_evaluations || []);
        setActiveMissionId((current) => current || response.mission_evaluations?.[0]?.id || "");
        setActiveSectionId(Number(response.evaluation.activeSectionId || response.evaluation.sections?.[0]?.id || 1));
        setPageIndexes(createInitialPageIndexes(response.evaluation.sections || []));
        setSavedComments(
          Object.fromEntries(
            (response.evaluation.sections || [])
              .filter((section) => section.comment?.trim())
              .map((section) => [section.id, section.comment.trim()])
          )
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de l'auto-évaluation manager impossible.");
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

  const activeSection = sections.find((section) => Number(section.id) === Number(activeSectionId)) || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const shouldShowSourceLabel = evaluationData?.manager?.department === "AUDIT & EXPERTISE COMPTABLE";
  const activePageSourceBadgeLabel = getSourceBadgeLabel(activePage);
  const completedSections = sections.filter((section) => getSectionProgress(section) === 100).length;
  const progress = Math.round(
    sections.reduce((total, section) => total + getSectionProgress(section), 0) / (sections.length || 1)
  );
  const averageScore = useMemo(() => getPageAverage(activePage), [activePage]);
  const rhRecipients = evaluationData?.submitted_to || [];
  const rhValidationRecipients = rhRecipients.filter(isRhValidationRecipient);
  const associateRecipients = evaluationData?.associate_recipients || [];
  const selectedAssociates = useMemo(
    () => associateRecipients.filter((recipient) => selectedAssociateValues.includes(getRecipientOptionValue(recipient))),
    [associateRecipients, selectedAssociateValues]
  );
  const availableAssociates = useMemo(
    () => associateRecipients.filter((recipient) => !selectedAssociateValues.includes(getRecipientOptionValue(recipient))),
    [associateRecipients, selectedAssociateValues]
  );

  function handleAddAssociateRecipient() {
    if (!selectedAssociateValue) return;

    setSelectedAssociateValues((current) =>
      current.includes(selectedAssociateValue) ? current : [...current, selectedAssociateValue]
    );
    setSelectedAssociateValue("");
    setFeedbackMessage("");
  }

  function handleRemoveAssociateRecipient(value) {
    setSelectedAssociateValues((current) => current.filter((item) => item !== value));
    setSelectedAssociateValue((current) => (current === value ? "" : current));
  }

  const missionProgress = missionEvaluations.length
    ? Math.round(missionEvaluations.reduce((total, mission) => total + getMissionProgress(mission), 0) / missionEvaluations.length)
    : 0;
  const finalMissionScore = useMemo(() => getMissionFinalScore(missionEvaluations), [missionEvaluations]);
  const submittedMissionsCount = missionEvaluations.filter((mission) => mission.status === "Soumise").length;
  const activeMission = missionEvaluations.find((mission) => mission.id === activeMissionId) || missionEvaluations[0] || null;
  const missionCriteriaGroups = useMemo(() => getMissionCriteriaGroups(activeMission?.criteria || []), [activeMission]);
  const missionSections = useMemo(() => getMissionSections(missionCriteriaGroups), [missionCriteriaGroups]);
  const activeMissionSectionId = missionSectionIds[activeMissionId] || missionSections[0]?.id || "";
  const activeMissionSection =
    missionSections.find((section) => section.id === activeMissionSectionId) || missionSections[0] || null;
  const activeMissionSectionIndex = missionSections.findIndex((section) => section.id === activeMissionSection?.id);
  const activeMissionPageIndex = Math.min(
    missionPageIndexes[activeMissionId] || 0,
    Math.max((activeMissionSection?.groups?.length || 1) - 1, 0)
  );
  const activeMissionGroup = activeMissionSection?.groups?.[activeMissionPageIndex] || activeMissionSection?.groups?.[0] || null;
  const isLastMissionStep =
    activeMissionSectionIndex === missionSections.length - 1 &&
    activeMissionPageIndex === Math.max((activeMissionSection?.groups?.length || 1) - 1, 0);
  const activeMissionAverage = useMemo(() => getMissionAverage(activeMission?.criteria || []), [activeMission]);

  const filteredMissionEvaluations = useMemo(() => {
    const query = normalizeSearchValue(missionSearchQuery.trim());
    if (!query) return missionEvaluations;

    return missionEvaluations.filter((item) => {
      const haystack = [item.title, ...getMissionEvaluatingRecipients(item).map((recipient) => recipient.name)]
        .map(normalizeSearchValue)
        .join(" ");
      return haystack.includes(query);
    });
  }, [missionEvaluations, missionSearchQuery]);

  const recentMissionEvaluations = useMemo(() => missionEvaluations.slice(-3).reverse(), [missionEvaluations]);

  useEffect(() => {
    if (!isMissionPickerOpen) return undefined;

    function handlePointerDown(event) {
      if (missionPickerRef.current && !missionPickerRef.current.contains(event.target)) {
        setIsMissionPickerOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsMissionPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMissionPickerOpen]);

  useEffect(() => {
    if (!activeMission?.id || !missionSections.length) return;

    const timeoutId = setTimeout(() => {
      setMissionSectionIds((current) => ({
        ...current,
        [activeMission.id]: current[activeMission.id] || missionSections[0].id,
      }));
      setMissionPageIndexes((current) => ({
        ...current,
        [activeMission.id]: current[activeMission.id] || 0,
      }));
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [activeMission?.id, missionSections]);

  function syncSections(updater) {
    setSections((currentSections) => {
      const nextSections = typeof updater === "function" ? updater(currentSections) : updater;

      return nextSections.map((section) => {
        const sectionProgress = getSectionProgress(section);
        return {
          ...section,
          status: sectionProgress === 0 ? "À faire" : sectionProgress === 100 ? "Complète" : "En cours",
        };
      });
    });

    setFeedbackMessage("");
  }

  function updateTheme(themeId, score) {
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

  function updateMissionScore(criterionId, score) {
    setMissionEvaluations((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== activeMissionId
          ? mission
          : {
              ...mission,
              status: mission.status === "Soumise" ? mission.status : "En cours",
              criteria: (mission.criteria || []).map((criterion) =>
                criterion.id === criterionId ? { ...criterion, score } : criterion
              ),
            }
      )
    );

    setFeedbackMessage("");
  }

  function updateMissionComment(comment) {
    setMissionEvaluations((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== activeMissionId
          ? mission
          : {
              ...mission,
              comment,
            }
      )
    );

    setFeedbackMessage("");
  }

  async function persistSections(
    nextSections = sections,
    successMessage = "Auto-évaluation manager enregistrée.",
    nextMissionEvaluations = missionEvaluations
  ) {
    try {
      setIsSaving(true);
      setFeedbackMessage("");
      const response = await saveManagerSelfEvaluation({
        sections: nextSections,
        missionEvaluations: nextMissionEvaluations,
      });

      setEvaluationData(response);
      setSections(response.evaluation.sections || []);
      setMissionEvaluations(response.mission_evaluations || []);
      setPageIndexes((current) => clampPageIndexes(response.evaluation.sections || [], current));
      setSavedComments(
        Object.fromEntries(
          (response.evaluation.sections || [])
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

  async function handleAddMission() {
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

    if (!selectedAssociates.length) {
      setFeedbackTone("error");
      setFeedbackMessage("Sélectionnez au moins un associé destinataire pour cette mission.");
      return;
    }

    try {
      setIsSaving(true);
      setFeedbackMessage("");
      const response = await createManagerMissionEvaluation({
        title,
        period: formatMissionPeriod("", missionStartDate, missionEndDate),
        selectedAssociateRecipients: selectedAssociates.map((associate) => ({
          id: associate.id,
          name: associate.name,
          grade: associate.grade,
          department: associate.department,
        })),
      });

      setEvaluationData(response);
      setSections(response.evaluation.sections || []);
      setMissionEvaluations(response.mission_evaluations || []);
      const addedMission = response.mission_evaluations?.[response.mission_evaluations.length - 1] || null;
      if (addedMission?.id) {
        setActiveMissionId(addedMission.id);
      }
      setMissionTitle("");
      setMissionStartDate("");
      setMissionEndDate("");
      setSelectedAssociateValues([]);
      setSelectedAssociateValue("");
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Mission manager ajoutée.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Ajout de mission impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  async function persistMissionEvaluations(nextMissionEvaluations = missionEvaluations, successMessage = "Mission manager enregistrée.") {
    const response = await persistSections(sections, successMessage, nextMissionEvaluations);
    if (response) {
      setMissionEvaluations(response.mission_evaluations || []);
    }
    return response;
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

  function selectMission(item) {
    setActiveMissionId(item.id);
    setIsMissionPickerOpen(false);
    setMissionSearchQuery("");
  }

  async function handleSaveAndContinue() {
    await persistSections(sections, "Auto-évaluation manager enregistrée.");
    goToStep(1);
  }

  async function handleSaveMissionAndContinue() {
    await persistMissionEvaluations(missionEvaluations, "Mission manager enregistrée.");
    goToMissionStep(1);
  }

  async function handleSubmit() {
    if (!hasRequiredSubmissionComment(sections)) {
      setFeedbackTone("error");
      setFeedbackMessage("Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant soumission.");
      return;
    }
    const savedEvaluation = await persistSections(sections, "Auto-évaluation manager prête pour soumission.");

    if (!savedEvaluation) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await submitManagerSelfEvaluation();
      setEvaluationData(response);
      setSections(response.evaluation.sections || []);
      setMissionEvaluations(response.mission_evaluations || []);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Auto-évaluation manager soumise à la RH.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitMission() {
    if (!activeMission) return;

    const missionAssociates = selectedAssociates.length ? selectedAssociates : getMissionEvaluatingRecipients(activeMission);

    if (!missionAssociates.length) {
      setFeedbackTone("error");
      setFeedbackMessage("Sélectionnez au moins un associé destinataire pour cette mission.");
      return;
    }

    const hasIncompleteCriterion = (activeMission.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      setFeedbackTone("error");
      setFeedbackMessage("Toutes les questions de la mission manager doivent être renseignées avant soumission.");
      return;
    }

    const savedMission = await persistMissionEvaluations(missionEvaluations, "Mission manager prête pour soumission.");

    if (!savedMission) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await submitManagerMissionEvaluation(activeMission.id, {
        selectedAssociateRecipients: missionAssociates.map((associate) => ({
          id: associate.id,
          name: associate.name,
          grade: associate.grade,
          department: associate.department,
        })),
      });
      setEvaluationData(response);
      setSections(response.evaluation.sections || []);
      setMissionEvaluations(response.mission_evaluations || []);
      setSelectedAssociateValues([]);
      setSelectedAssociateValue("");
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Mission manager soumise à la RH et aux associés.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission de la mission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'auto-évaluation manager...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!evaluationData || !sections.length || !activeSection || !activePage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucune matrice manager disponible.</section>;
  }

  const isLastStep =
    Number(activeSectionId) === Number(sections[sections.length - 1]?.id) &&
    activePageIndex === (activeSection.pages?.length || 1) - 1;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-400">
        {evaluationData.manager.name} - {evaluationData.manager.grade} - {evaluationData.evaluation.cycle_label}
      </p>

      <div className="rounded-sm bg-[#DCECCB] px-4 py-3 text-xs font-semibold text-[#1E5B34]">
        Cette auto-évaluation globale est transmise à la RH. Les missions soumises sont partagées à la RH et aux associés.
      </div>

      {feedbackMessage ? (
        <div
          className={`rounded-md px-4 py-3 text-sm font-semibold ${
            feedbackTone === "error" ? "bg-[#FDEBEC] text-[#B93840]" : "bg-[#DCECCB] text-[#184D2E]"
          }`}
        >
          {feedbackMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveView("cycle")}
          className={`hidden rounded-md p-4 text-left transition ${
            activeView === "cycle" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Vue cycle</p>
          <h2 className="mt-1 text-lg font-black">Auto-évaluation manager</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">{progress}% sur la matrice annuelle</p>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("missions")}
          className={`rounded-md p-4 text-left transition ${
            activeView === "missions" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Vue mission</p>
          <h2 className="mt-1 text-lg font-black">Auto-évaluation par mission</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">{missionEvaluations.length} mission(s) - {missionProgress}%</p>
        </button>
      </section>

      {activeView === "cycle" ? (
        <>
          <section className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-[#0F3A63]">
                Progression - {completedSections} / {sections.length} sections
              </p>
              <span className={`text-xs font-semibold ${getProgressToneClass(progress)}`}>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-300">
              <div className={`h-2 rounded-full ${getProgressBarClass(progress)}`} style={{ width: `${clampProgress(progress)}%` }} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-3 xl:col-span-5">
              {sections.map((section) => {
                const sectionProgress = getSectionProgress(section);
                const isActive = Number(activeSectionId) === Number(section.id);

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      setActiveSectionId(Number(section.id));
                      setFeedbackMessage("");
                    }}
                    className={`w-full rounded-md bg-white p-4 text-left shadow-sm transition ${
                      isActive ? "ring-2 ring-[#79B742]" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-[#79B742]">
                          Section {section.id} - {section.title}
                        </h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{section.pages?.length || 0} titre(s)</p>
                      </div>
                      <SectionBadge progress={sectionProgress} />
                    </div>

                    <div className="space-y-2">
                      {(section.pages || []).slice(0, 3).map((page) => (
                        <div key={page.page_id} className="flex items-center justify-between text-xs font-semibold text-[#0F3A63]">
                          <p>{page.title}</p>
                          <span className={getPageAverage(page) === "--" ? "text-slate-400" : "text-[#79B742]"}>
                            {getPageAverage(page) === "--" ? "--" : `${getPageAverage(page)}/5`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}

              <article className="rounded-md bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-semibold text-[#79B742]">Commentaires sauvegardés</h3>
                <div className="mb-4 space-y-3">
                  {sections.some((section) => savedComments[section.id]) ? (
                    sections
                      .filter((section) => savedComments[section.id])
                      .map((section) => (
                        <div key={section.id} className="rounded-md bg-slate-50 px-3 py-3">
                          <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{savedComments[section.id]}</p>
                        </div>
                      ))
                  ) : (
                    <p className="rounded-md bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                      Aucun commentaire sauvegardé pour le moment.
                    </p>
                  )}
                </div>

                <h3 className="mb-3 text-xs font-semibold text-[#79B742]">Circuit de validation</h3>
                <div className="space-y-3 text-xs font-semibold text-[#0F3A63]">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DFECD4] text-[#79B742]">
                      <Check size={12} />
                    </span>
                    <p>Vous saisissez votre auto-évaluation</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2AA7D6] text-white">
                      1
                    </span>
                    <div>
                      <p>Soumission à la RH</p>
                      <p className="text-[11px] text-slate-400">Après complétion de toutes les sections de la matrice</p>
                    </div>
                  </div>
                  {rhValidationRecipients.map((recipient, index) => (
                    <div key={recipient.id} className="flex items-start gap-3">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                        {index + 2}
                      </span>
                      <p>
                        Validation RH - {recipient.name} ({getRhRecipientRoleLabel(recipient)})
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div className="space-y-3 xl:col-span-7">
              <article className="rounded-md bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#0F3A63]">
                      Section {activeSection.id} - {activeSection.title}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Score moyen : {averageScore} / 5</p>
                  </div>
                  <SectionBadge progress={getSectionProgress(activeSection)} />
                </div>

                <div className="mb-4 rounded-md bg-[#F8FAFC] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-500">Pagination dans la section</p>
                      <h4 className="text-[18px] font-bold text-[#0F3A63]">{activeSection.title}</h4>
                    </div>
                    <span className="text-[12px] font-semibold text-[#0F3A63]">
                      Titre {activePageIndex + 1} / {activeSection.pages?.length || 1}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(activeSection.pages || []).map((page, index) => {
                      const isActive = index === activePageIndex;
                      const pageProgress = getPageProgress(page);
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
                              ? "border-[#79B742] bg-[#F3FAEA] text-[#0F3A63]"
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
                          <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(pageProgress)}`}>{pageProgress}%</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
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
                    <div key={theme.theme_id} className="space-y-2">
                      <p className="text-xs font-semibold text-[#0F3A63]">
                        {theme.code}. {theme.label}
                      </p>
                      <p className="text-xs text-slate-500">{theme.statement}</p>
                      <ScoreSelector selected={theme.score} onSelect={(score) => updateTheme(theme.theme_id, score)} />
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-[#79B742]">Commentaire de section</p>
                  <textarea
                    rows={3}
                    value={activeSection.comment || ""}
                    onChange={(event) => updateComment(event.target.value)}
                    placeholder="Synthèse globale de la section, points forts, axes d'amelioration..."
                    className="w-full resize-none rounded-md border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
                  />
                </div>

                {savedComments[activeSection.id] ? (
                  <div className="mt-3 rounded-md bg-[#DCECCB] px-3 py-3">
                    <p className="mb-1 text-xs font-bold text-[#79B742]">Commentaire sauvegardé</p>
                    <p className="text-sm font-semibold text-[#0F3A63]">{savedComments[activeSection.id]}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
                        className="inline-flex items-center gap-2 rounded-md bg-[#003B63] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-70"
                      >
                        Sauvegarder et continuer
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => persistSections(sections)}
                        disabled={isSaving || isSubmitting}
                        className="rounded-md bg-[#79B742] px-8 py-2 text-xs font-semibold text-white disabled:opacity-70"
                      >
                        {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSaving || isSubmitting || evaluationData.evaluation.status === "Soumis a RH"}
                      className="rounded-md bg-[#79B742] px-8 py-2 text-xs font-semibold text-white disabled:opacity-70"
                    >
                      {isSubmitting ? "Soumission..." : "Soumettre à la RH"}
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="flex gap-2 border-b border-[#E3EAF3]">
            <button
              type="button"
              onClick={() => setActiveMissionView("synthese")}
              className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-bold transition ${
                activeMissionView === "synthese" ? "border-[#E3EAF3] bg-white text-[#0F3A63]" : "border-transparent text-slate-500 hover:text-[#0F3A63]"
              }`}
            >
              Synthèse et ajout de mission
            </button>
            <button
              type="button"
              onClick={() => setActiveMissionView("missions")}
              className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-bold transition ${
                activeMissionView === "missions" ? "border-[#E3EAF3] bg-white text-[#0F3A63]" : "border-transparent text-slate-500 hover:text-[#0F3A63]"
              }`}
            >
              Mes missions
            </button>
          </div>

          {activeMissionView === "synthese" ? (
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.78fr_1.22fr]">
              <article className="space-y-4">
                <div className="rounded-md bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Ajouter une mission</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Saisissez le nom de la mission, sa date de début et sa date de fin. Elle sera ensuite soumise à la RH et aux associés.
                  </p>
                  <div className="mt-4 space-y-3">
                    <input
                      value={missionTitle}
                      onChange={(event) => setMissionTitle(event.target.value)}
                      placeholder="Nom ou type de mission"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
                    />
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500">Date de début</span>
                      <input
                        type="date"
                        value={missionStartDate}
                        onChange={(event) => setMissionStartDate(event.target.value)}
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-[#0F3A63] outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500">Date de fin</span>
                      <input
                        type="date"
                        value={missionEndDate}
                        min={missionStartDate || undefined}
                        onChange={(event) => setMissionEndDate(event.target.value)}
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-[#0F3A63] outline-none"
                      />
                    </label>
                  </div>
                  <div className="mt-3 rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-bold text-[#0F3A63]">Évaluateurs de la mission</p>
                    <div className="mt-3 rounded-md bg-slate-200/60 p-3 text-xs font-semibold text-slate-500">
                      {selectedAssociates.length ? (
                        <div className="space-y-2">
                          {selectedAssociates.map((associate) => {
                            const value = getRecipientOptionValue(associate);

                            return (
                              <div key={value} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                                <span className="text-[#0F3A63]">
                                  Associés - {associate.name} ({associate.grade || "Associé"})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssociateRecipient(value)}
                                  className="text-[11px] font-bold text-red-500"
                                >
                                  Retirer
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        "Aucun évaluateur sélectionné pour le moment."
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <select
                        value={selectedAssociateValue}
                        onChange={(event) => setSelectedAssociateValue(event.target.value)}
                        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-[#0F3A63] outline-none"
                      >
                        <option value="">Sélectionner un supérieur</option>
                        {availableAssociates.map((associate) => {
                          const value = getRecipientOptionValue(associate);

                          return (
                            <option key={value} value={value}>
                              Associés - {associate.name} ({associate.grade || "Associé"})
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddAssociateRecipient}
                        disabled={!selectedAssociateValue}
                        className="rounded-md bg-[#8CAFC7] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMission}
                    disabled={isSaving || isSubmitting}
                    className="mt-4 rounded-md bg-[#79B742] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    {isSaving ? "Ajout..." : "Ajouter la mission"}
                  </button>
                </div>
              </article>

              <article className="space-y-4">
                <div className="rounded-md bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[22px] font-bold text-[#0F3A63]">Synthèse des missions</h3>
                      <p className="mt-1 text-[12px] font-semibold text-slate-500">
                        Score final = somme des scores de mission divisée par le nombre de missions notées.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                      Score final {finalMissionScore} / 5
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-semibold text-[#0F3A63]">Progression globale des missions</p>
                      <span className={`font-bold ${getProgressToneClass(missionProgress)}`}>{missionProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className={`h-2 rounded-full ${getProgressBarClass(missionProgress)}`} style={{ width: `${clampProgress(missionProgress)}%` }} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-md bg-[#F8FAFC] px-3 py-3">
                        <p className="text-[11px] font-semibold text-slate-500">Missions</p>
                        <p className="mt-1 text-lg font-black text-[#0F3A63]">{missionEvaluations.length}</p>
                      </div>
                      <div className="rounded-md bg-[#F8FAFC] px-3 py-3">
                        <p className="text-[11px] font-semibold text-slate-500">Missions soumises</p>
                        <p className="mt-1 text-lg font-black text-[#0F3A63]">{submittedMissionsCount}</p>
                      </div>
                      <div className="rounded-md bg-[#F8FAFC] px-3 py-3">
                        <p className="text-[11px] font-semibold text-slate-500">Statut</p>
                        <p className="mt-1 text-sm font-black text-[#0F3A63]">{evaluationData?.evaluation?.status || "En cours"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Mes missions</h3>
                  <div className="space-y-3">
                    {missionEvaluations.length ? (
                      missionEvaluations.map((mission) => {
                        const isActive = mission.id === activeMission?.id;
                        const currentMissionProgress = getMissionProgress(mission);

                        return (
                          <button
                            key={mission.id}
                            type="button"
                            onClick={() => setActiveMissionId(mission.id)}
                            className={`w-full rounded-md p-4 text-left shadow-sm transition ${
                              isActive ? "bg-[#EEF6E8] ring-2 ring-[#79B742]" : "bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">{formatMissionPeriod(mission.period)}</p>
                                {getMissionEvaluatingRecipients(mission).length ? (
                                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                    Associé(s) : {getMissionEvaluatingRecipients(mission).map((recipient) => recipient.name).join(", ")}
                                  </p>
                                ) : null}
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.status}</span>
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${getProgressToneClass(currentMissionProgress)}`}>
                              Progression : {currentMissionProgress}%
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <p className="rounded-md bg-[#EEF2F6] p-4 text-sm font-semibold text-slate-500">
                        Aucune mission manager ajoutée pour le moment.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            </section>
          ) : (
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.78fr_1.22fr]">
              <article className="space-y-4">
                <div ref={missionPickerRef} className="relative rounded-md bg-white p-4 shadow-sm">
                  <p className="mb-2 text-[12px] font-bold text-[#0F3A63]">Mission</p>
                  {missionEvaluations.length ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsMissionPickerOpen((current) => !current)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-left text-[13px] font-bold text-[#0F3A63]"
                      >
                        <span className="truncate">{activeMission ? activeMission.title : "Sélectionner une mission"}</span>
                        <ChevronDown size={16} className={`shrink-0 transition ${isMissionPickerOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isMissionPickerOpen ? (
                        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-md border border-[#E3EAF3] bg-white p-2 shadow-lg">
                          <input
                            autoFocus
                            value={missionSearchQuery}
                            onChange={(event) => setMissionSearchQuery(event.target.value)}
                            placeholder="Rechercher par nom de mission ou d'associé..."
                            className="mb-2 w-full rounded-md bg-slate-100 px-3 py-2 text-[12px] font-semibold text-[#0F3A63] outline-none"
                          />
                          <div className="max-h-72 space-y-1 overflow-y-auto">
                            {filteredMissionEvaluations.length ? (
                              filteredMissionEvaluations.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => selectMission(item)}
                                  className={`block w-full rounded-md px-3 py-2 text-left transition ${
                                    item.id === activeMission?.id ? "bg-[#F3FAEA] text-[#0F3A63]" : "text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <p className="text-[12px] font-bold">{item.title}</p>
                                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                    {formatMissionPeriod(item.period)} · {item.status}
                                  </p>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-2 text-[12px] font-semibold text-slate-500">Aucune mission ne correspond à la recherche.</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Aucune mission manager ajoutée pour le moment.</p>
                  )}
                </div>

                {recentMissionEvaluations.length ? (
                  <div className="space-y-3">
                    <p className="text-[12px] font-bold text-[#0F3A63]">Missions récentes</p>
                    {recentMissionEvaluations.map((item) => {
                      const progress = getMissionProgress(item);
                      const isActive = item.id === activeMission?.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectMission(item)}
                          className={`w-full rounded-md border p-3 text-left transition ${
                            isActive ? "border-[#79B742] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-extrabold text-[#0F3A63]">{item.title}</p>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">{item.status}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{formatMissionPeriod(item.period)}</p>
                          <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                            <div className={`h-1.5 rounded-full ${getProgressBarClass(progress)}`} style={{ width: `${clampProgress(progress)}%` }} />
                          </div>
                          <p className={`mt-1 text-xs font-bold ${getProgressToneClass(progress)}`}>{progress}% complétée</p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>

              <article className="space-y-4">
                <div className="rounded-md bg-white p-4 shadow-sm">
                  {activeMission ? (
                    <>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-400">{formatMissionPeriod(activeMission.period)}</p>
                          <h2 className="mt-1 text-xl font-black text-[#0F3A63]">{activeMission.title}</h2>
                          <p className="mt-1 text-xs font-semibold text-slate-500">Score moyen mission : {activeMissionAverage} / 5</p>
                        </div>
                        <span className="rounded-full bg-[#E7EDF3] px-4 py-2 text-xs font-bold text-[#0F4A72]">{activeMission.status}</span>
                      </div>

                      <div className="mb-4 rounded-md bg-[#F8FAFC] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-semibold text-slate-500">Pagination dans la mission</p>
                            <h4 className="text-[18px] font-bold text-[#0F3A63]">{activeMissionSection?.title || "Mission manager"}</h4>
                          </div>
                          <span className="text-[12px] font-semibold text-[#0F3A63]">
                            Titre {activeMissionPageIndex + 1} / {activeMissionSection?.groups?.length || 1}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(activeMissionSection?.groups || []).map((group, index) => {
                            const groupProgress = Math.round(
                              (((group.criteria || []).filter((criterion) => criterion.score !== null && criterion.score !== undefined).length) /
                                ((group.criteria || []).length || 1)) *
                                100
                            );

                            return (
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
                                    ? "border-[#79B742] bg-[#F3FAEA] text-[#0F3A63]"
                                    : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <p className="text-[11px] font-bold">Titre {index + 1}</p>
                                <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                                <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(groupProgress)}`}>{groupProgress}%</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mb-4 space-y-3">
                        {(missionSections || []).map((section) => {
                          const isActive = section.id === activeMissionSectionId;
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
                              className={`w-full rounded-md border px-3 py-3 text-left transition ${
                                isActive ? "border-[#79B742] bg-[#F3FAEA]" : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-[#0F3A63]">{section.title}</p>
                                <span className={`text-xs font-semibold ${getProgressToneClass(getMissionSectionProgress(section))}`}>{getMissionSectionProgress(section)}%</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {activeMissionGroup ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[11px] font-bold uppercase text-slate-500">{activeMissionGroup.sectionTitle}</p>
                            <p className="mt-1 text-[15px] font-bold text-[#0F3A63]">{activeMissionGroup.pageTitle}</p>
                          </div>

                          {(activeMissionGroup.criteria || []).map((criterion) => (
                            <div key={criterion.id} className="space-y-2">
                              <p className="text-xs font-semibold text-[#0F3A63]">
                                {criterion.themeCode}. {criterion.label}
                              </p>
                              <p className="text-xs text-slate-500">{criterion.statement}</p>
                              <ScoreSelector selected={criterion.score} onSelect={(score) => updateMissionScore(criterion.id, score)} />
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold text-[#79B742]">Commentaire sur la mission</p>
                        <textarea
                          rows={3}
                          value={activeMission.comment || ""}
                          onChange={(event) => updateMissionComment(event.target.value)}
                          placeholder="Elements marquants, difficultes, impact..."
                          className="w-full resize-none rounded-md border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => goToMissionStep(-1)}
                          disabled={activeMissionSectionIndex <= 0 && activeMissionPageIndex === 0}
                          className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronLeft size={14} />
                          Précédent
                        </button>

                        {!isLastMissionStep ? (
                          <button
                            type="button"
                            onClick={handleSaveMissionAndContinue}
                            disabled={isSaving || isSubmitting}
                            className="inline-flex items-center gap-2 rounded-md bg-[#79B742] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                          >
                            Sauvegarder et continuer
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
                              onClick={() => persistMissionEvaluations(missionEvaluations)}
                              disabled={isSaving || isSubmitting}
                              className="inline-flex items-center gap-2 rounded-md bg-[#79B742] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                            >
                              {isSaving ? "Sauvegarde..." : "Enregistrer la mission"}
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md bg-[#EEF2F6] p-5 text-sm font-semibold text-slate-500">
                      Ajoutez une mission manager pour commencer l'auto-évaluation par mission.
                    </div>
                  )}
                </div>
              </article>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Monautoevaluation;
