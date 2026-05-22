import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getMySeniorEvaluation,
  saveMySeniorEvaluation,
  submitMySeniorEvaluation,
  submitMySeniorMissionEvaluation,
} from "@/lib/seniorEvaluation";
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

  const recipientDepartment = mission.recipients?.[0]?.department || mission.department || "";
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
  const [addMissionFeedback, setAddMissionFeedback] = useState(null);
  const [missionFeedback, setMissionFeedback] = useState(null);
  const [finalFeedback, setFinalFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const missionCreationCounterRef = useRef(0);
  const skipAutoSaveRef = useRef(true);
  const autoSaveTimeoutRef = useRef(null);
  const dirtyMissionRef = useRef(false);

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

    if (!selectedRecipient) {
      setScopedFeedback("addMission", "error", "Sélectionnez un manager destinataire pour cette mission.");
      return;
    }

    if (missionStartDate && missionEndDate && missionEndDate < missionStartDate) {
      setScopedFeedback("addMission", "error", "La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }

    clearScopedFeedback("addMission");

    missionCreationCounterRef.current += 1;

    const nextMission = {
      id: `senior-mission-${missionCreationCounterRef.current}-${missionEvaluations.length + 1}`,
      title,
      period: formatMissionPeriodLabel(missionStartDate, missionEndDate),
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
    setSelectedRecipientValue(initialRecipientValue);

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
    const response = await persistMissionEvaluations(missionEvaluations, {
      scope: "mission",
      showSuccess: false,
    });

    if (response) {
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

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <article className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">{evaluationData?.assignee?.current_cycle || "Cycle 2025-2026"}</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#0F3A63]">{displayName}</h2>
            <p className="text-sm font-semibold text-slate-500">{user?.grade || evaluationData?.assignee?.grade || "Senior"}</p>
          </div>

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
              <select
                value={effectiveRecipientValue}
                onChange={(event) => {
                  setSelectedRecipientValue(event.target.value);
                  clearScopedFeedback("addMission");
                }}
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
              <InlineFeedback feedback={addMissionFeedback} />
            </div>
          </div>

          <div className="space-y-3">
            {missionEvaluations.length ? (
              missionEvaluations.map((mission) => (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => {
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
                  }}
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
                    <div className="h-2 rounded-full bg-[#76B82A]" style={{ width: `${getMissionProgress(mission)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">{getMissionProgress(mission)}%</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.status || "Brouillon"}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-md bg-[#EEF2F6] p-4 text-sm font-semibold text-slate-500">Aucune mission ajoutée pour le moment.</div>
            )}
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
                <span className="font-bold text-[#76B82A]">{missionProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-[#76B82A]" style={{ width: `${missionProgress}%` }} />
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
                  {(activeMissionSection?.groups || []).map((group, index) => (
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
                      <p className="text-[11px] font-bold">Titre {index + 1}</p>
                      <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                      {shouldShowSourceLabel &&
                      getSourceBadgeLabel({ source_label: group.sourceLabel, source_sheet: group.sourceSheet }) &&
                      group.sourceSheet !== "TRONC COMMUN" ? (
                        <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                          {getSourceBadgeLabel({ source_label: group.sourceLabel, source_sheet: group.sourceSheet })}
                        </span>
                      ) : null}
                      <p className="mt-1 text-[10px] font-semibold text-[#76B82A]">{getMissionGroupProgress(group)}%</p>
                    </button>
                  ))}
                </div>
              </section>

              {activeMissionGroup ? (
                <section className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase text-slate-500">{activeMissionGroup.sectionTitle}</p>
                    <p className="mt-1 text-[15px] font-bold text-[#0F3A63]">{activeMissionGroup.pageTitle}</p>
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
                      <MissionScoreRow key={criterion.id} criterion={criterion} onSelect={(score) => updateMissionScore(criterion.id, score)} />
                    ))}
                  </div>

                  <div className="mt-4 rounded-md bg-[#F8FAFC] p-3">
                    <label className="text-[12px] font-bold text-[#0F3A63]">
                      Commentaire de section <span className="text-[11px] text-slate-500">(minimum 3 caractères)</span>
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

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  persistMissionEvaluations(missionEvaluations, {
                    scope: "final",
                  })
                }
                disabled={isSaving || isSubmitting}
                className="rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 disabled:opacity-70"
              >
                {isSaving ? "Sauvegarde..." : "Enregistrer"}
              </button>
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
          </section>
        </article>
      </section>
    </section>
  );
}

export default MonautoevaluationSenior;
