import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import {
  getMySeniorEvaluation,
  saveMySeniorChiefComments,
  saveMySeniorEvaluation,
  submitMySeniorEvaluation,
  submitMySeniorMissionEvaluation,
} from "@/lib/seniorEvaluation";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";
import { getDisplayName } from "@/lib/userPresentation";

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - à améliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - dépasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excellent - référence dans l'équipe", color: "text-[#76B82A]" },
];

function getRecipientLabel(recipient) {
  if (!recipient?.name) return "";
  if (!recipient?.grade) return recipient.name;
  return `${recipient.name} (${recipient.grade})`;
}

function getRecipientOptionValue(recipient) {
  return `${recipient.department}::${recipient.id}`;
}

function normalizeDepartment(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeSearchValue(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function getSourceBadgeLabel(page) {
  if (page?.source_label) return page.source_label;
  if (page?.source_sheet === "AUDIT") return "Audit";
  if (page?.source_sheet === "EXPERTISE COMPTABLE") return "Expertise comptable";
  return "";
}

function formatDisplayDate(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatMissionPeriodLabel(startDate, endDate) {
  const formattedStartDate = formatDisplayDate(startDate);
  const formattedEndDate = formatDisplayDate(endDate);

  if (!formattedStartDate && !formattedEndDate) return "Période non renseignée";
  if (formattedStartDate && formattedEndDate) return `Du ${formattedStartDate} au ${formattedEndDate}`;
  if (formattedStartDate) return `À partir du ${formattedStartDate}`;
  return `Jusqu'au ${formattedEndDate}`;
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
            sectionComment: "",
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

function getMissionSections(groups = []) {
  const sections = [];

  for (const group of groups) {
    const existingSection = sections.find((section) => section.title === group.sectionTitle);

    if (existingSection) {
      if (!existingSection.comment) {
        existingSection.comment =
          group.criteria?.find((criterion) => String(criterion.sectionComment || "").trim())?.sectionComment || "";
      }
      existingSection.groups.push(group);
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

function getMissionGroupProgress(group) {
  const criteria = group?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function getMissionSectionProgress(section) {
  const criteria = (section?.groups || []).flatMap((group) => group.criteria || []);
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

function sanitizeMissionEvaluation(mission) {
  if (!mission) return mission;

  const recipientDepartment = mission.department || mission.recipients?.[0]?.department || "";
  return {
    ...mission,
    criteria: (mission.criteria || []).filter((criterion) =>
      shouldShowMissionGroupForRecipient(
        { sourceSheet: criterion.sourceSheet || criterion.source_sheet || "" },
        recipientDepartment
      )
    ),
  };
}

function sanitizeMissionEvaluations(missions = []) {
  return missions.map(sanitizeMissionEvaluation);
}

function InlineFeedback({ feedback }) {
  if (!feedback?.message) return null;

  return (
    <div
      className={`rounded-md px-3 py-2 text-xs font-semibold ${
        feedback.tone === "error" ? "bg-[#FDEBEC] text-[#B93840]" : "bg-[#DCECCB] text-[#184D2E]"
      }`}
    >
      {feedback.message}
    </div>
  );
}

function MissionScoreRow({ criterion, onSelect, onRemove }) {
  return (
    <div className="rounded-md border border-[#E3EAF3] bg-[#F8FBFF] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#0F3A63]">
          {criterion.themeCode ? `${criterion.themeCode}. ` : ""}
          {criterion.label}
        </p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200"
          >
            Retirer
          </button>
        ) : null}
      </div>
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

function MonautoevaluationSenior({ user }) {
  const [evaluationData, setEvaluationData] = useState(null);
  const [sections, setSections] = useState([]);
  const [missionEvaluations, setMissionEvaluations] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [missionSectionIds, setMissionSectionIds] = useState({});
  const [missionPageIndexes, setMissionPageIndexes] = useState({});
  const [missionTitle, setMissionTitle] = useState("");
  const [missionStartDate, setMissionStartDate] = useState("");
  const [missionEndDate, setMissionEndDate] = useState("");
  const [selectedRecipientValue, setSelectedRecipientValue] = useState("");
  const [selectedRecipientValues, setSelectedRecipientValues] = useState([]);
  const [addMissionFeedback, setAddMissionFeedback] = useState(null);
  const [missionFeedback, setMissionFeedback] = useState(null);
  const [finalFeedback, setFinalFeedback] = useState(null);
  const [chiefComments, setChiefComments] = useState([]);
  const [chiefTargetValue, setChiefTargetValue] = useState("");
  const [chiefFeedback, setChiefFeedback] = useState(null);
  const [isSavingChief, setIsSavingChief] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState("synthese");
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  const [isMissionPickerOpen, setIsMissionPickerOpen] = useState(false);
  const [customTitre, setCustomTitre] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customStatement, setCustomStatement] = useState("");
  const [customCriterionFeedback, setCustomCriterionFeedback] = useState(null);
  const missionCreationCounterRef = useRef(0);
  const customCriterionCounterRef = useRef(0);
  const skipAutoSaveRef = useRef(true);
  const autoSaveTimeoutRef = useRef(null);
  const dirtyMissionRef = useRef(false);
  const missionPickerRef = useRef(null);

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
        setActiveMissionId(response.mission_evaluations?.[0]?.id || null);
        setChiefComments(response.chief_comments || []);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de l'auto-évaluation impossible.");
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
      department: recipient.department || item.department,
    }))
  );
  const chiefCommentTargetOptions = useMemo(() => {
    const raw = evaluationData?.assignee?.comment_targets || [];
    return raw.filter(
      (recipient, index, list) =>
        recipient.name &&
        list.findIndex((item) => item.id === recipient.id) === index
    );
  }, [evaluationData?.assignee?.comment_targets]);
  const selectedRecipients = useMemo(
    () => recipientOptions.filter((recipient) => selectedRecipientValues.includes(getRecipientOptionValue(recipient))),
    [recipientOptions, selectedRecipientValues]
  );

  const effectiveMissionId =
    missionEvaluations.some((mission) => mission.id === activeMissionId) ? activeMissionId : missionEvaluations[0]?.id || null;
  const activeMission = missionEvaluations.find((mission) => mission.id === effectiveMissionId) || null;
  const missionCriteriaGroups = useMemo(() => getMissionCriteriaGroups(activeMission?.criteria || []), [activeMission]);
  const filteredMissionCriteriaGroups = useMemo(() => {
    const recipientDepartment = activeMission?.recipients?.[0]?.department || activeMission?.department || "";
    return missionCriteriaGroups.filter((group) => shouldShowMissionGroupForRecipient(group, recipientDepartment));
  }, [activeMission, missionCriteriaGroups]);
  const missionSections = useMemo(() => getMissionSections(filteredMissionCriteriaGroups), [filteredMissionCriteriaGroups]);
  const activeMissionSectionId = missionSectionIds[effectiveMissionId] || missionSections[0]?.id || "";
  const activeMissionSection = missionSections.find((section) => section.id === activeMissionSectionId) || missionSections[0] || null;
  const activeMissionSectionIndex = missionSections.findIndex((section) => section.id === activeMissionSection?.id);
  const activeMissionPageIndex = Math.min(
    missionPageIndexes[effectiveMissionId] || 0,
    Math.max((activeMissionSection?.groups?.length || 1) - 1, 0)
  );
  const activeMissionGroup = activeMissionSection?.groups?.[activeMissionPageIndex] || activeMissionSection?.groups?.[0] || null;
  const shouldShowSourceLabel = evaluationData?.assignee?.department === "AUDIT & EXPERTISE COMPTABLE";
  const activeMissionAverage = getMissionAverage(activeMission?.criteria || []);
  const finalMissionScore = useMemo(() => getMissionFinalScore(missionEvaluations), [missionEvaluations]);
  const missionProgress = missionEvaluations.length
    ? Math.round(missionEvaluations.reduce((total, mission) => total + getMissionProgress(mission), 0) / missionEvaluations.length)
    : 0;
  const submittedMissionsCount = missionEvaluations.filter((mission) => mission.status === "Soumise").length;
  const displayName = getDisplayName(user || evaluationData?.assignee || {});

  const filteredMissionEvaluations = useMemo(() => {
    const query = normalizeSearchValue(missionSearchQuery.trim());
    if (!query) return missionEvaluations;

    return missionEvaluations.filter((mission) => {
      const haystack = [mission.title, ...(mission.recipients || []).map((recipient) => recipient.name)]
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

  function clearScopedFeedback(scope) {
    if (scope === "addMission") setAddMissionFeedback(null);
    if (scope === "mission") setMissionFeedback(null);
    if (scope === "final") setFinalFeedback(null);
  }

  function setScopedFeedback(scope, tone, message) {
    const payload = message ? { tone, message } : null;

    if (scope === "addMission") setAddMissionFeedback(payload);
    if (scope === "mission") setMissionFeedback(payload);
    if (scope === "final") setFinalFeedback(payload);
  }

  function addSelectedRecipient() {
    if (!selectedRecipientValue) return;

    setSelectedRecipientValues((current) =>
      current.includes(selectedRecipientValue) ? current : [...current, selectedRecipientValue]
    );
    setSelectedRecipientValue("");
    clearScopedFeedback("addMission");
  }

  function removeSelectedRecipient(value) {
    setSelectedRecipientValues((current) => current.filter((item) => item !== value));
    clearScopedFeedback("addMission");
  }

  function addChiefComment() {
    const recipient = chiefCommentTargetOptions.find((item) => item.id === chiefTargetValue);
    if (!recipient) return;
    const targetUserId = recipient.id;
    setChiefComments((current) =>
      current.some((item) => String(item.targetUserId || "") === String(targetUserId))
        ? current
        : [
            ...current,
            {
              targetUserId,
              targetName: recipient.name,
              targetGrade: recipient.grade,
              targetDepartment: recipient.department,
              comment: "",
            },
          ]
    );
    setChiefTargetValue("");
    setChiefFeedback(null);
  }

  function updateChiefComment(targetUserId, comment) {
    setChiefComments((current) =>
      current.map((item) => (String(item.targetUserId || "") === String(targetUserId) ? { ...item, comment } : item))
    );
    setChiefFeedback(null);
  }

  function removeChiefComment(targetUserId) {
    setChiefComments((current) => current.filter((item) => String(item.targetUserId || "") !== String(targetUserId)));
    setChiefFeedback(null);
  }

  async function handleSendChiefComments() {
    const hasCommentToSend = chiefComments.some((item) => String(item.comment || "").trim() && !item.submittedAt);
    if (!hasCommentToSend) {
      setChiefFeedback({ tone: "error", message: "Rédigez au moins un commentaire avant d'envoyer." });
      return;
    }

    setIsSavingChief(true);
    setChiefFeedback(null);
    const now = new Date().toISOString();
    const toSend = chiefComments.map((item) =>
      String(item.comment || "").trim() && !item.submittedAt ? { ...item, submittedAt: now } : item
    );
    try {
      await saveMySeniorChiefComments(toSend);
      setChiefComments(toSend);
      setChiefFeedback({ tone: "success", message: "Commentaire(s) envoyé(s) avec succès." });
    } catch (error) {
      setChiefFeedback({ tone: "error", message: error.message || "Envoi impossible." });
    } finally {
      setIsSavingChief(false);
    }
  }

  function selectMission(mission) {
    setActiveMissionId(mission.id);
    setMissionSectionIds((current) => ({
      ...current,
      [mission.id]: current[mission.id] || mission.criteria?.[0]?.sectionTitle || "",
    }));
    setMissionPageIndexes((current) => ({
      ...current,
      [mission.id]: current[mission.id] || 0,
    }));
    clearScopedFeedback("mission");
    setIsMissionPickerOpen(false);
    setMissionSearchQuery("");
  }

  async function persistMissionEvaluations(
    nextMissionEvaluations = missionEvaluations,
    { scope = null, showSuccess = true, showError = true } = {}
  ) {
    clearTimeout(autoSaveTimeoutRef.current);
    setIsSaving(true);

    try {
      const response = await saveMySeniorEvaluation({
        missionEvaluations: nextMissionEvaluations,
      });
      dirtyMissionRef.current = false;
      skipAutoSaveRef.current = true;
      setEvaluationData(response);
      setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
      if (scope && showSuccess) {
        setScopedFeedback(scope, "success", response.message || "Sauvegarde réussie.");
      }
      return response;
    } catch (error) {
      if (scope && showError) {
        setScopedFeedback(scope, "error", error.message || "Sauvegarde impossible.");
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return undefined;
    }

    if (!dirtyMissionRef.current || !missionEvaluations.length) {
      return undefined;
    }

    clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      void saveMySeniorEvaluation({
        missionEvaluations,
      })
        .then((response) => {
          dirtyMissionRef.current = false;
          setEvaluationData(response);
        })
        .catch((error) => {
          setScopedFeedback("mission", "error", error.message || "Sauvegarde impossible.");
        });
    }, 300);

    return () => {
      clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [missionEvaluations]);

  useEffect(() => {
    return () => {
      clearTimeout(autoSaveTimeoutRef.current);

      if (dirtyMissionRef.current && missionEvaluations.length) {
        void saveMySeniorEvaluation({
          missionEvaluations,
        });
      }
    };
  }, [missionEvaluations]);

  async function handleAddMission() {
    const title = missionTitle.trim();

    if (!title) {
      setScopedFeedback("addMission", "error", "Renseignez le nom de la mission.");
      return;
    }

    if (!selectedRecipients.length) {
      setScopedFeedback("addMission", "error", "Sélectionnez au moins un destinataire pour cette mission.");
      return;
    }

    if (missionStartDate && missionEndDate && missionEndDate < missionStartDate) {
      setScopedFeedback("addMission", "error", "La date de fin doit ?tre post?rieure ou ?gale ? la date de d?but.");
      return;
    }

    clearScopedFeedback("addMission");

    missionCreationCounterRef.current += 1;

    const primaryRecipient = selectedRecipients[0];
    const nextMission = {
      id: `senior-mission-${missionCreationCounterRef.current}-${missionEvaluations.length + 1}`,
      title,
      period: formatMissionPeriodLabel(missionStartDate, missionEndDate),
      department: primaryRecipient.department,
      recipients: selectedRecipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        grade: recipient.grade,
        department: recipient.department,
      })),
      criteria: buildMissionCriteriaFromSections(sections, primaryRecipient.department),
      status: "Brouillon",
    };

    const nextMissionEvaluations = [...missionEvaluations, nextMission];
    clearTimeout(autoSaveTimeoutRef.current);
    skipAutoSaveRef.current = true;
    dirtyMissionRef.current = true;
    setMissionEvaluations(nextMissionEvaluations);
    setActiveMissionId(nextMission.id);
    setMissionSectionIds((current) => ({
      ...current,
      [nextMission.id]: nextMission.criteria[0]?.sectionTitle || "",
    }));
    setMissionPageIndexes((current) => ({ ...current, [nextMission.id]: 0 }));
    setMissionTitle("");
    setMissionStartDate("");
    setMissionEndDate("");
    setSelectedRecipientValue("");
    setSelectedRecipientValues([]);

    const savedResponse = await persistMissionEvaluations(nextMissionEvaluations, {
      scope: "addMission",
    });
    if (!savedResponse) return;

    setScopedFeedback("addMission", "success", "Mission ajoutée et enregistrée.");
  }

  function updateMissionScore(criterionId, score) {
    dirtyMissionRef.current = true;
    clearScopedFeedback("mission");
    clearScopedFeedback("final");
    setMissionEvaluations((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== effectiveMissionId
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) => (criterion.id === criterionId ? { ...criterion, score } : criterion)),
            }
      )
    );
  }

  function updateMissionSectionComment(comment) {
    dirtyMissionRef.current = true;
    clearScopedFeedback("mission");
    clearScopedFeedback("final");
    setMissionEvaluations((currentMissions) =>
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
  }

  function addCustomMissionCriterion() {
    if (!activeMission || !activeMissionSection) return;

    const titre = customTitre.trim();
    const label = customLabel.trim();

    if (!titre || !label) {
      setCustomCriterionFeedback({ tone: "error", message: "Renseignez un titre et le libellé de la compétence." });
      return;
    }

    customCriterionCounterRef.current += 1;

    const newCriterion = {
      id: `custom-${activeMission.id}-${Date.now()}-${customCriterionCounterRef.current}`,
      sectionTitle: activeMissionSection.title,
      sectionComment: activeMissionSection.comment || "",
      pageTitle: titre,
      sourceSheet: "",
      sourceLabel: "",
      themeCode: "",
      label,
      statement: customStatement.trim(),
      score: null,
      isCustom: true,
    };

    const existingGroupIndex = (activeMissionSection.groups || []).findIndex(
      (group) => group.pageTitle === titre && !group.sourceSheet && !group.sourceLabel
    );
    const targetPageIndex = existingGroupIndex >= 0 ? existingGroupIndex : (activeMissionSection.groups || []).length;

    dirtyMissionRef.current = true;
    clearScopedFeedback("mission");
    clearScopedFeedback("final");
    setMissionEvaluations((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== effectiveMissionId ? mission : { ...mission, criteria: [...mission.criteria, newCriterion] }
      )
    );
    setMissionPageIndexes((current) => ({
      ...current,
      [activeMission.id]: targetPageIndex,
    }));
    setCustomTitre("");
    setCustomLabel("");
    setCustomStatement("");
    setCustomCriterionFeedback({ tone: "success", message: "Compétence ajoutée." });
  }

  function removeCustomMissionCriterion(criterionId) {
    dirtyMissionRef.current = true;
    clearScopedFeedback("mission");
    clearScopedFeedback("final");
    setMissionEvaluations((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== effectiveMissionId
          ? mission
          : { ...mission, criteria: mission.criteria.filter((criterion) => criterion.id !== criterionId) }
      )
    );
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
    if (String(activeMissionSection?.comment || "").trim().length < 3) {
      setScopedFeedback("mission", "error", "Le commentaire de section d'au moins 3 caractères est obligatoire avant de continuer.");
      return;
    }

    const response = await persistMissionEvaluations(missionEvaluations, {
      scope: "mission",
      showSuccess: false,
    });

    if (response) {
      clearScopedFeedback("mission");
      goToMissionStep(1);
    }
  }

  async function handleSubmitMission() {
    if (!activeMission) return;

    const hasIncompleteCriterion = (activeMission.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      setScopedFeedback("mission", "error", "Toutes les questions de la mission doivent être renseignées avant soumission.");
      return;
    }

    const hasSectionWithoutComment = missionSections.some((section) => String(section.comment || "").trim().length < 3);
    if (hasSectionWithoutComment) {
      setScopedFeedback("mission", "error", "Un commentaire d'au moins 3 caractères est obligatoire pour chaque section de la mission.");
      return;
    }

    clearScopedFeedback("mission");
    setIsSubmitting(true);

    try {
      const savedResponse = await persistMissionEvaluations(missionEvaluations, {
        scope: "mission",
        showSuccess: false,
      });
      if (!savedResponse) return;

      const response = await submitMySeniorMissionEvaluation(activeMission.id);
      dirtyMissionRef.current = false;
      setEvaluationData(response);
      setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
      setScopedFeedback("mission", "success", response.message || "Mission soumise.");
    } catch (error) {
      setScopedFeedback("mission", "error", error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitFinal() {
    if (!missionEvaluations.length) {
      setScopedFeedback("final", "error", "Ajoutez au moins une mission avant la soumission finale.");
      return;
    }

    const pendingMissions = missionEvaluations.some((mission) => mission.status !== "Soumise");
    if (pendingMissions) {
      setScopedFeedback("final", "error", "Chaque mission doit être soumise avant la soumission finale.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistMissionEvaluations(missionEvaluations, {
        scope: "final",
        showSuccess: false,
      });
      if (!savedResponse) return;

      const response = await submitMySeniorEvaluation();
      dirtyMissionRef.current = false;
      setEvaluationData(response);
      setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
      setScopedFeedback("final", "success", response.message || "Évaluations par mission soumises aux managers.");
    } catch (error) {
      setScopedFeedback("final", "error", error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement de l'auto-évaluation...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
        {errorMessage}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
        Le Senior s'évalue désormais uniquement par mission. Les commentaires de section sont obligatoires.
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">{evaluationData?.assignee?.current_cycle || "Cycle 2025-2026"}</p>
        <h2 className="mt-1 text-xl font-extrabold text-[#0F3A63]">{displayName}</h2>
        <p className="text-sm font-semibold text-slate-500">{user?.grade || evaluationData?.assignee?.grade || "Senior"}</p>
      </div>

      <div className="flex gap-2 border-b border-[#E3EAF3]">
        <button
          type="button"
          onClick={() => setActiveTab("synthese")}
          className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-bold transition ${
            activeTab === "synthese" ? "border-[#E3EAF3] bg-white text-[#0F3A63]" : "border-transparent text-slate-500 hover:text-[#0F3A63]"
          }`}
        >
          Synthèse et ajout de mission
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("missions")}
          className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-bold transition ${
            activeTab === "missions" ? "border-[#E3EAF3] bg-white text-[#0F3A63]" : "border-transparent text-slate-500 hover:text-[#0F3A63]"
          }`}
        >
          Mes missions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("chef-comment")}
          className={`inline-flex items-center gap-2 rounded-t-md border border-b-0 px-4 py-2 text-sm font-bold transition ${
            activeTab === "chef-comment" ? "border-[#E3EAF3] bg-white text-[#0F3A63]" : "border-transparent text-slate-500 hover:text-[#0F3A63]"
          }`}
        >
          <MessageSquare size={14} />
          Commentaire anonyme
          {chiefComments.length > 0 && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#0B4C7A] text-[9px] font-bold text-white">
              {chiefComments.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "synthese" && (
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <article className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[18px] font-bold text-[#0F3A63]">Ajouter une mission</h3>
            <div className="space-y-3">
              <input
                value={missionTitle}
                onChange={(event) => {
                  setMissionTitle(event.target.value);
                  clearScopedFeedback("addMission");
                }}
                placeholder="Nom ou type de mission"
                className="w-full rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
              />
              <div className="text-[11px] font-semibold text-slate-500">Date de début</div>
              <input
                type="date"
                value={missionStartDate}
                onChange={(event) => {
                  setMissionStartDate(event.target.value);
                  clearScopedFeedback("addMission");
                }}
                className="w-full rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
              />
              <div className="text-[11px] font-semibold text-slate-500">Date de fin</div>
              <input
                type="date"
                min={missionStartDate || undefined}
                value={missionEndDate}
                onChange={(event) => {
                  setMissionEndDate(event.target.value);
                  clearScopedFeedback("addMission");
                }}
                className="w-full rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
              />
              <div className="rounded-md bg-white p-3">
                <p className="text-[12px] font-bold text-[#0F3A63]">Destinataires sélectionnés</p>
                {selectedRecipients.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRecipients.map((recipient) => {
                      const value = getRecipientOptionValue(recipient);
                      return (
                        <span
                          key={value}
                          className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#EEF6E8] px-3 py-1.5 text-[11px] font-semibold text-[#0F3A63]"
                        >
                          <span className="truncate">
                            {recipient.department} - {getRecipientLabel(recipient)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelectedRecipient(value)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#0F3A63]"
                            aria-label={`Retirer ${getRecipientLabel(recipient)}`}
                          >
                            x
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">Aucun destinataire sélectionné pour le moment.</p>
                )}
                {recipientOptions.length ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selectedRecipientValue}
                      onChange={(event) => {
                        setSelectedRecipientValue(event.target.value);
                        clearScopedFeedback("addMission");
                      }}
                      className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0F3A63] outline-none"
                    >
                      <option value="">Sélectionner un destinataire</option>
                      {recipientOptions.map((recipient) => {
                        const value = getRecipientOptionValue(recipient);
                        const isAlreadySelected = selectedRecipientValues.includes(value);

                        return (
                          <option key={value} value={value} disabled={isAlreadySelected}>
                            {recipient.department} - {getRecipientLabel(recipient)}
                            {isAlreadySelected ? " - déjà sélectionné" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={addSelectedRecipient}
                      disabled={!selectedRecipientValue}
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
                className="rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
              >
                Ajouter la mission
              </button>
              <InlineFeedback feedback={addMissionFeedback} />
            </div>
          </div>
        </article>

        <article className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
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

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSubmitFinal}
                disabled={isSaving || isSubmitting}
                className="rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
              >
                {isSubmitting ? "Soumission..." : "Finaliser l'évaluation"}
              </button>
            </div>
            <div className="mt-3">
              <InlineFeedback feedback={finalFeedback} />
            </div>
          </div>
        </article>
      </section>
      )}

      {activeTab === "missions" && (
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <article className="space-y-4">
          <div ref={missionPickerRef} className="relative rounded-xl bg-white p-4 shadow-sm">
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
                      placeholder="Rechercher par nom de mission ou de destinataire..."
                      className="mb-2 w-full rounded-md bg-slate-100 px-3 py-2 text-[12px] font-semibold text-[#0F3A63] outline-none"
                    />
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {filteredMissionEvaluations.length ? (
                        filteredMissionEvaluations.map((mission) => (
                          <button
                            key={mission.id}
                            type="button"
                            onClick={() => selectMission(mission)}
                            className={`block w-full rounded-md px-3 py-2 text-left transition ${
                              mission.id === effectiveMissionId ? "bg-[#F3FAEA] text-[#0F3A63]" : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <p className="text-[12px] font-bold">{mission.title}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                              {mission.period || "Période non renseignée"} · {mission.recipients.map(getRecipientLabel).join(", ")}
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
              <p className="text-sm font-semibold text-slate-500">Aucune mission ajoutée pour le moment.</p>
            )}
          </div>

          {recentMissionEvaluations.length ? (
            <div className="space-y-3">
              <p className="text-[12px] font-bold text-[#0F3A63]">Missions récentes</p>
              {recentMissionEvaluations.map((mission) => (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => selectMission(mission)}
                  className={`w-full rounded-xl border p-4 text-left shadow-sm transition ${
                    mission.id === effectiveMissionId ? "border-[#76B82A] bg-[#F3FAEA]" : "border-transparent bg-white"
                  }`}
                >
                  <p className="text-[18px] font-bold text-[#0F3A63]">{mission.title}</p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-500">{mission.period || "Période non renseignée"}</p>
                  <p className="mt-2 text-[12px] font-semibold text-[#0F3A63]">
                    {mission.department} - {mission.recipients.map(getRecipientLabel).join(", ")}
                  </p>
                  <div className="mt-4 h-2 rounded-full bg-slate-200">
                    <div className={`h-2 rounded-full ${getProgressBarClass(getMissionProgress(mission))}`} style={{ width: `${clampProgress(getMissionProgress(mission))}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${getProgressToneClass(getMissionProgress(mission))}`}>{getMissionProgress(mission)}%</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.status || "Brouillon"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[20px] font-bold text-[#0F3A63]">Aide à la notation</h3>
            </div>
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
          </section>
        </article>

        <article className="space-y-4">
          {activeMission ? (
            <>
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black leading-tight text-[#0F3A63]">{activeMission.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{activeMission.period || "Période non renseignée"}</p>
                    <p className="mt-1 text-sm font-bold text-[#0F4A72]">
                      Validation : {activeMission.department} - Destinataire : {activeMission.recipients?.[0]?.name || "Manager"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                    Moyenne {activeMissionAverage} / 5
                  </span>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {missionSections.map((section) => {
                    const isActive = section.id === activeMissionSection?.id;
                    const progress = getMissionSectionProgress(section);

                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                          setMissionSectionIds((current) => ({
                            ...current,
                            [activeMission.id]: section.id,
                          }));
                          setMissionPageIndexes((current) => ({
                            ...current,
                            [activeMission.id]: 0,
                          }));
                        }}
                        className={`rounded-md border px-3 py-3 text-left text-white transition ${
                          isActive ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]" : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold">{section.title}</p>
                          <span className="text-xs font-semibold">{progress}%</span>
                        </div>
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
                    const isCustomGroup = group.criteria.some((item) => item.isCustom);

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
                            ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]"
                            : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] font-bold">Titre {index + 1}</p>
                          {isCustomGroup ? (
                            <span className="rounded-full bg-[#DCECCB] px-1.5 py-0.5 text-[9px] font-bold text-[#4E8B1B]">Ajouté</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                        {shouldShowSourceLabel &&
                        getSourceBadgeLabel({ source_label: group.sourceLabel, source_sheet: group.sourceSheet }) &&
                        group.sourceSheet !== "TRONC COMMUN" ? (
                          <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                            {getSourceBadgeLabel({ source_label: group.sourceLabel, source_sheet: group.sourceSheet })}
                          </span>
                        ) : null}
                        <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(getMissionGroupProgress(group))}`}>{getMissionGroupProgress(group)}%</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-md border border-dashed border-[#C7D6E8] bg-white p-3">
                  <p className="text-[12px] font-bold text-[#0F3A63]">{`Ajouter un titre à "${activeMissionSection?.title || ""}"`}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {"Ce titre s'ajoutera aux autres titres de cette section, avec sa propre progression. Il ne s'applique qu'à cette mission et compte dans la moyenne et la note finale."}
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <input
                      value={customTitre}
                      onChange={(event) => {
                        setCustomTitre(event.target.value);
                        setCustomCriterionFeedback(null);
                      }}
                      placeholder="Titre"
                      className="h-10 w-full rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
                    />
                    <input
                      value={customLabel}
                      onChange={(event) => {
                        setCustomLabel(event.target.value);
                        setCustomCriterionFeedback(null);
                      }}
                      placeholder="Libellé de la compétence"
                      className="h-10 w-full rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={customStatement}
                    onChange={(event) => {
                      setCustomStatement(event.target.value);
                      setCustomCriterionFeedback(null);
                    }}
                    placeholder="Description (optionnel)"
                    className="mt-2 w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[12px] text-slate-600 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={addCustomMissionCriterion}
                    className="mt-2 rounded-md bg-[#76B82A] px-4 py-2 text-xs font-bold text-white"
                  >
                    Ajouter le titre
                  </button>
                  <div className="mt-2">
                    <InlineFeedback feedback={customCriterionFeedback} />
                  </div>
                </div>
              </section>

              {activeMissionGroup ? (
                <section className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase text-slate-500">{activeMissionGroup.sectionTitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[15px] font-bold text-[#0F3A63]">{activeMissionGroup.pageTitle}</p>
                      {activeMissionGroup.criteria.some((item) => item.isCustom) ? (
                        <span className="rounded-full bg-[#DCECCB] px-2 py-0.5 text-[10px] font-bold text-[#4E8B1B]">
                          Titre ajouté
                        </span>
                      ) : null}
                    </div>
                    {shouldShowSourceLabel &&
                    getSourceBadgeLabel({ source_label: activeMissionGroup.sourceLabel, source_sheet: activeMissionGroup.sourceSheet }) &&
                    activeMissionGroup.sourceSheet !== "TRONC COMMUN" ? (
                      <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[11px] font-semibold text-[#0F3A63]">
                        {getSourceBadgeLabel({ source_label: activeMissionGroup.sourceLabel, source_sheet: activeMissionGroup.sourceSheet })}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-3.5">
                    {(activeMissionGroup.criteria || []).map((criterion) => (
                      <MissionScoreRow
                        key={criterion.id}
                        criterion={criterion}
                        onSelect={(score) => updateMissionScore(criterion.id, score)}
                        onRemove={criterion.isCustom ? () => removeCustomMissionCriterion(criterion.id) : undefined}
                      />
                    ))}
                  </div>

                  <div className="mt-4 rounded-md bg-[#F8FAFC] p-3">
                    <label className="text-[12px] font-bold text-[#0F3A63]">
                      Commentaire de section <span className="text-red-600">*</span>{" "}
                      <span className="text-[11px] text-slate-500">(minimum 3 caractères)</span>
                    </label>
                    <textarea
                      value={activeMissionSection?.comment || ""}
                      onChange={(event) => updateMissionSectionComment(event.target.value)}
                      rows={3}
                      placeholder="Synthèse de la section pour cette mission..."
                      className="mt-2 w-full resize-none rounded-md bg-white px-3 py-2 text-[12px] text-[#0F3A63] outline-none ring-1 ring-[#D9E3EE] focus:ring-[#76B82A]"
                    />
                  </div>

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
                      {!(activeMissionSectionIndex === missionSections.length - 1 && activeMissionPageIndex === Math.max((activeMissionSection?.groups?.length || 1) - 1, 0)) ? (
                        <button
                          type="button"
                          onClick={handleSaveAndContinue}
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
                            {isSubmitting ? "Soumission..." : activeMission.status === "Soumise" ? "Retransmettre la mission" : "Soumettre la mission"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              persistMissionEvaluations(missionEvaluations, {
                                scope: "mission",
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                          >
                            Enregistrer la mission
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <InlineFeedback feedback={missionFeedback} />
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
              Aucune mission ajoutée pour le moment.
            </section>
          )}
        </article>
      </section>
      )}

      {activeTab === "chef-comment" && (
        <section className="space-y-4">
          <article className="rounded-md bg-white p-5 shadow-sm">
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[22px] font-bold text-[#0F3A63]">Commentaire anonyme</h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  Choisissez un supérieur et rédigez un commentaire. Cliquez sur{" "}
                  <span className="font-bold text-[#0F3A63]">Envoyer</span> pour le transmettre — il apparaîtra
                  directement chez votre supérieur. Un commentaire envoyé ne peut plus être modifié.
                </p>
              </div>
              <span className="rounded-full border border-[#D9E3EE] bg-white px-3 py-1 text-[11px] font-bold text-[#0F4A72]">
                Anonyme · Visible par le destinataire
              </span>
            </div>

            {chiefCommentTargetOptions.some(
              (recipient) => !chiefComments.some((item) => String(item.targetUserId || "") === String(recipient.id))
            ) && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select
                  value={chiefTargetValue}
                  onChange={(event) => setChiefTargetValue(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#D9E3EE] bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
                >
                  <option value="">Sélectionner une personne</option>
                  {chiefCommentTargetOptions.map((recipient) => {
                    const alreadyAdded = chiefComments.some((item) => String(item.targetUserId || "") === String(recipient.id));
                    return (
                      <option key={recipient.id} value={recipient.id} disabled={alreadyAdded}>
                        {recipient.department} — {recipient.name} ({recipient.grade})
                        {alreadyAdded ? " · déjà ajouté" : ""}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={addChiefComment}
                  disabled={!chiefTargetValue}
                  className="h-10 rounded-md bg-[#0B4C7A] px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {chiefComments.length ? (
                chiefComments.map((item) => {
                  const isSent = Boolean(item.submittedAt);
                  return (
                    <div
                      key={item.targetUserId || item.targetName}
                      className={`rounded-md border p-4 ${isSent ? "border-[#C3DFAA] bg-[#F4FAED]" : "border-[#E3EAF3] bg-[#F8FBFF]"}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-bold text-[#0F3A63]">{item.targetName}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            {item.targetDepartment} — {item.targetGrade}
                          </p>
                        </div>
                        {isSent ? (
                          <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-[10px] font-bold text-[#4E8B1B]">
                            Envoyé
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeChiefComment(item.targetUserId)}
                            className="rounded-md bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-200"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                      {isSent ? (
                        <p className="rounded-md bg-white px-3 py-2 text-[12px] text-slate-700 ring-1 ring-[#C3DFAA]">
                          {item.comment || "—"}
                        </p>
                      ) : (
                        <textarea
                          rows={4}
                          value={item.comment || ""}
                          onChange={(event) => updateChiefComment(item.targetUserId, event.target.value)}
                          placeholder={`Votre commentaire pour ${item.targetName}…`}
                          className="w-full resize-none rounded-md bg-white px-3 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-[#D9E3EE] focus:ring-[#0B4C7A]"
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-md bg-[#EEF2F6] px-4 py-4 text-sm font-semibold text-slate-500">
                  Aucun supérieur sélectionné pour le moment.
                </p>
              )}
            </div>

            {chiefComments.some((item) => !item.submittedAt && String(item.comment || "").trim()) && (
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSendChiefComments}
                  disabled={isSavingChief}
                  className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-5 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                >
                  {isSavingChief ? "Envoi…" : "Envoyer"}
                </button>
                {chiefFeedback && (
                  <span
                    className={`text-[12px] font-semibold ${
                      chiefFeedback.tone === "error" ? "text-[#B93840]" : "text-[#184D2E]"
                    }`}
                  >
                    {chiefFeedback.message}
                  </span>
                )}
              </div>
            )}

            {chiefFeedback && !chiefComments.some((item) => !item.submittedAt && String(item.comment || "").trim()) && (
              <div className="mt-4">
                <span
                  className={`text-[12px] font-semibold ${
                    chiefFeedback.tone === "error" ? "text-[#B93840]" : "text-[#184D2E]"
                  }`}
                >
                  {chiefFeedback.message}
                </span>
              </div>
            )}
          </article>
        </section>
      )}
    </section>
  );
}

export default MonautoevaluationSenior;
