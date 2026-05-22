import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import {
  saveMyAssistantEvaluation,
  submitMyAssistantEvaluation,
  submitMyAssistantMissionEvaluation,
} from "@/lib/collaboratorEvaluation";

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - à améliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - dépasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excéllent - référence dans l'équipe", color: "text-[#76B82A]" },
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

function formatMissionPeriodLabel(startDate, endDate) {
  const formatDate = (value) => {
    if (!value) return "";
    const [year, month, day] = String(value).split("-");
    if (!year || !month || !day) return value;
    return `${day}-${month}-${year}`;
  };

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);

  if (!formattedStartDate && !formattedEndDate) return "Période non renseignée";
  if (formattedStartDate && formattedEndDate) return `Du ${formattedStartDate} au ${formattedEndDate}`;
  if (formattedStartDate) return `À partir du ${formattedStartDate}`;
  return `Jusqu'au ${formattedEndDate}`;
}

function getMissionFinalScore(missions = []) {
  const missionScores = missions
    .map((mission) => {
      const average = getMissionAverage(mission.criteria || []);
      return average === "--" ? null : Number(average);
    })
    .filter((score) => typeof score === "number");

  if (!missionScores.length) return "--";
  return (missionScores.reduce((total, score) => total + score, 0) / missionScores.length).toFixed(1);
}

function getMissionAssignmentLabel(mission) {
  if (mission?.createdByRole === "senior") {
    return `Mission ajoutée par ${mission?.assignedByName || "le senior"}`;
  }

  return "";
}

function getMissionEvaluationDepartment(mission) {
  return mission?.primaryRecipientDepartment || mission?.department || mission?.recipients?.[0]?.department || "";
}

function getMissionPrimaryRecipient(mission) {
  if (mission?.createdByRole === "senior") {
    return mission?.assignedByName || "";
  }

  if (mission?.primaryRecipientName) {
    return mission.primaryRecipientName;
  }

  return mission?.recipients?.[0]?.name || "";
}

function getMissionValidationLabel(mission) {
  const department = getMissionEvaluationDepartment(mission);
  const primaryRecipient = getMissionPrimaryRecipient(mission);

  if (mission?.createdByRole === "senior") {
    return primaryRecipient ? `${department} - Destinataire : ${primaryRecipient}` : department;
  }

  if (!department) {
    return primaryRecipient ? `Destinataire : ${primaryRecipient}` : "Circuit de validation du département";
  }

  return primaryRecipient ? `${department} - Destinataire : ${primaryRecipient}` : `${department} - Circuit de validation du département`;
}

function isSameMissionId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function buildMissionCriteriaFromSections(sections = [], recipientDepartment = "") {
  return sections.flatMap((section) =>
    (section.pages || []).flatMap((page) =>
      shouldShowMissionGroupForRecipient(
        {
          sourceSheet: page.source_sheet || "",
        },
        recipientDepartment
      )
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

function getMissionGroupProgress(group) {
  const criteria = group?.criteria || [];
  const answered = criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  if (!criteria.length) return 0;
  return Math.round((answered / criteria.length) * 100);
}

function sanitizeMissionEvaluation(mission) {
  if (!mission) return mission;

  const recipientDepartment = getMissionEvaluationDepartment(mission);
  return {
    ...mission,
    department: recipientDepartment || mission.department || "",
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
      if (!existingSection.comment && group.criteria?.[0]?.sectionComment) {
        existingSection.comment = group.criteria[0].sectionComment;
      }
      existingSection.groups.push(group);
      continue;
    }

    sections.push({
      id: group.sectionTitle,
      title: group.sectionTitle,
      comment: group.criteria?.[0]?.sectionComment || "",
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
  const departmentRecipients = evaluationData?.assignee?.recipient_options || [];
  const recipientOptions = departmentRecipients.flatMap((item) =>
    (item.users || []).map((recipient) => ({
      ...recipient,
      department: item.department,
    }))
  );
  const initialRecipientValue = recipientOptions[0] ? getRecipientOptionValue(recipientOptions[0]) : "";
  const [missionEvaluations, setMissionEvaluations] = useState(() => sanitizeMissionEvaluations(evaluationData?.mission_evaluations || []));
  const [MissionId, setMissionId] = useState(null);
  const [missionSectionIds, setMissionSectionIds] = useState({});
  const [missionPageIndexes, setMissionPageIndexes] = useState({});
  const [missionTitle, setMissionTitle] = useState("");
  const [missionStartDate, setMissionStartDate] = useState("");
  const [missionEndDate, setMissionEndDate] = useState("");
  const [selectedRecipientValue, setSelectedRecipientValue] = useState(initialRecipientValue);
  const [sections] = useState(() => evaluationData?.evaluation?.sections || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const missionCreationCounterRef = useRef(0);

  const shouldShowSourceLabel = evaluationData?.assignee?.department === "AUDIT & EXPERTISE COMPTABLE";
  const effectiveMissionId =
    missionEvaluations.some((mission) => isSameMissionId(mission.id, MissionId)) ? MissionId : missionEvaluations[0]?.id || null;
  const Mission = missionEvaluations.find((mission) => isSameMissionId(mission.id, effectiveMissionId)) || null;
  const missionProgress = missionEvaluations.length
    ? Math.round(missionEvaluations.reduce((total, mission) => total + getMissionProgress(mission), 0) / missionEvaluations.length)
    : 0;
  const MissionAverage = useMemo(() => getMissionAverage(Mission?.criteria), [Mission]);
  const finalMissionScore = useMemo(() => getMissionFinalScore(missionEvaluations), [missionEvaluations]);
  const submittedMissionsCount = missionEvaluations.filter((mission) => mission.status === "Soumise").length;
  const filteredMissionCriteriaGroups = useMemo(() => {
    const allGroups = getMissionCriteriaGroups(Mission?.criteria || []);
    const recipientDepartment = getMissionEvaluationDepartment(Mission);

    return allGroups.filter((group) => shouldShowMissionGroupForRecipient(group, recipientDepartment));
  }, [Mission]);
  const missionSections = useMemo(() => getMissionSections(filteredMissionCriteriaGroups), [filteredMissionCriteriaGroups]);
  const MissionSectionId = missionSectionIds[effectiveMissionId] || missionSections[0]?.id || "";
  const MissionSection =
    missionSections.find((section) => section.id === MissionSectionId) || missionSections[0] || null;
  const MissionSectionIndex = missionSections.findIndex((section) => section.id === MissionSection?.id);
  const MissionPageIndex = Math.min(
    missionPageIndexes[effectiveMissionId] || 0,
    Math.max((MissionSection?.groups?.length || 1) - 1, 0)
  );
  const MissionGroup = MissionSection?.groups?.[MissionPageIndex] || MissionSection?.groups?.[0] || null;
  const effectiveRecipientValue =
    selectedRecipientValue && recipientOptions.some((recipient) => getRecipientOptionValue(recipient) === selectedRecipientValue)
      ? selectedRecipientValue
      : initialRecipientValue;
  const selectedRecipient = useMemo(
    () => recipientOptions.find((recipient) => getRecipientOptionValue(recipient) === effectiveRecipientValue) || null,
    [effectiveRecipientValue, recipientOptions]
  );
  const managerRecipients = useMemo(() => {
    const recipients = missionEvaluations.flatMap((mission) =>
      (mission.recipients || []).map((manager) => ({
        department: mission.department,
        manager: manager.name,
        grade: manager.grade,
      }))
    );

    return recipients.filter(
      (recipient, index, list) =>
        recipient.manager &&
        list.findIndex(
          (item) => item.manager === recipient.manager && item.department === recipient.department && item.grade === recipient.grade
        ) === index
    );
  }, [missionEvaluations]);

  useEffect(() => {
    onMissionEvaluationsChange?.(missionEvaluations);
  }, [missionEvaluations, onMissionEvaluationsChange]);

  const addMission = async () => {
    const title = missionTitle.trim();
    if (!title) {
      setFeedbackTone("error");
      setFeedbackMessage("Renseignez le nom de la mission.");
      return;
    }

    if (!selectedRecipient) {
      setFeedbackTone("error");
      setFeedbackMessage("Sélectionnez un destinataire pour cette mission.");
      return;
    }

    if (missionStartDate && missionEndDate && missionEndDate < missionStartDate) {
      setFeedbackTone("error");
      setFeedbackMessage("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }

    const autoRecipients = [selectedRecipient].map((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      grade: recipient.grade,
      department: recipient.department,
    }));

    missionCreationCounterRef.current += 1;

    const nextMission = {
      id: `mission-${missionCreationCounterRef.current}-${missionEvaluations.length + 1}`,
      title,
      period: formatMissionPeriodLabel(missionStartDate, missionEndDate),
      department: selectedRecipient.department || evaluationData?.assignee?.department || "",
      createdByRole: "self",
      primaryRecipientUserId: selectedRecipient.id,
      primaryRecipientName: selectedRecipient.name,
      primaryRecipientGrade: selectedRecipient.grade,
      primaryRecipientDepartment: selectedRecipient.department,
      recipients: autoRecipients,
      criteria: buildMissionCriteriaFromSections(sections, selectedRecipient.department || evaluationData?.assignee?.department || ""),
      comment: "",
    };

    const nextMissionEvaluations = [...missionEvaluations, nextMission];

    setMissionEvaluations(nextMissionEvaluations);
    setMissionId(nextMission.id);
    setMissionSectionIds((current) => ({
      ...current,
      [nextMission.id]: nextMission.criteria[0]?.sectionTitle || "",
    }));
    setMissionPageIndexes((current) => ({ ...current, [nextMission.id]: 0 }));
    setMissionTitle("");
    setMissionStartDate("");
    setMissionEndDate("");
    setSelectedRecipientValue(initialRecipientValue);

    const savedResponse = await persistMissionEvaluations(nextMissionEvaluations);
    if (!savedResponse) {
      return;
    }

    setFeedbackTone("success");
    setFeedbackMessage("Mission ajoutée et enregistrée. Elle restera disponible même si vous quittez la page.");
  };

  const updateMissionScore = (criterionLabel, score) => {
    setMissionEvaluations((missions) =>
      missions.map((mission) =>
        !isSameMissionId(mission.id, effectiveMissionId)
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) =>
                criterion.id === criterionLabel ? { ...criterion, score } : criterion
              ),
            }
      )
    );
  };

  const updateMissionSectionComment = (comment) => {
    setMissionEvaluations((missions) =>
      missions.map((mission) =>
        !isSameMissionId(mission.id, effectiveMissionId)
          ? mission
          : {
              ...mission,
              criteria: mission.criteria.map((criterion) =>
                criterion.sectionTitle === MissionSection?.title ? { ...criterion, sectionComment: comment } : criterion
              ),
            }
      )
    );
  };

  const goToMissionStep = (direction) => {
    if (!Mission || !MissionSection) return;

    const nextPageIndex = MissionPageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < (MissionSection.groups?.length || 0)) {
      setMissionPageIndexes((current) => ({
        ...current,
        [Mission.id]: nextPageIndex,
      }));
      return;
    }

    const nextSection = missionSections[MissionSectionIndex + direction];
    if (!nextSection) return;

    setMissionSectionIds((current) => ({
      ...current,
      [Mission.id]: nextSection.id,
    }));
    setMissionPageIndexes((current) => ({
      ...current,
      [Mission.id]: direction > 0 ? 0 : Math.max((nextSection.groups?.length || 1) - 1, 0),
    }));
  };

  const persistMissionEvaluations = async (nextMissionEvaluations = missionEvaluations) => {
    setIsSaving(true);

    try {
      const response = await saveMyAssistantEvaluation({
        missionEvaluations: nextMissionEvaluations,
      });
      setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Sauvegarde réussie.");
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

  const handleSubmitMission = async () => {
    if (!Mission) return;

    const hasIncompleteCriterion = (Mission.criteria || []).some(
      (criterion) => criterion.score === null || criterion.score === undefined
    );

    if (hasIncompleteCriterion) {
      setFeedbackTone("error");
      setFeedbackMessage("Toutes les questions de la mission doivent être renseignées avant soumission.");
      return;
    }

    const hasSectionWithoutComment = missionSections.some(
      (section) => String(section.comment || "").trim().length < 3
    );

    if (hasSectionWithoutComment) {
      setFeedbackTone("error");
      setFeedbackMessage("Un commentaire de section d'au moins 3 caractères est obligatoire pour chaque section avant soumission.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistMissionEvaluations(missionEvaluations);
      if (!savedResponse) return;

      const response = await submitMyAssistantMissionEvaluation(Mission.id);
      setMissionEvaluations(sanitizeMissionEvaluations(response.mission_evaluations || []));
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Mission soumise.");
      onEvaluationChange?.(response);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission de la mission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!missionEvaluations.length) {
      setFeedbackTone("error");
      setFeedbackMessage("Ajoutez au moins une mission avant la soumission finale.");
      return;
    }

    const hasSectionWithoutComment = missionEvaluations.some(
      (mission) =>
        getMissionSections(getMissionCriteriaGroups(mission.criteria || [])).some(
          (section) => String(section.comment || "").trim().length < 3
        )
    );

    if (hasSectionWithoutComment) {
      setFeedbackTone("error");
      setFeedbackMessage("Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant la soumission finale.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedResponse = await persistMissionEvaluations(missionEvaluations);
      if (!savedResponse) return;

      const submittedResponse = await submitMyAssistantEvaluation({
        managerRecipients,
        missionEvaluations,
      });
      setFeedbackTone("success");
      setFeedbackMessage(submittedResponse.message || "Évaluations par mission soumises aux managers.");
      onEvaluationChange?.(submittedResponse);
      onSubmitted?.(submittedResponse);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastMissionStep =
    MissionSectionIndex === missionSections.length - 1 &&
    MissionPageIndex === (MissionSection?.groups?.length || 1) - 1;

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-slate-500">
        {evaluationData?.assignee?.current_cycle || "Cycle 2025-2026"} - Auto-évaluation par mission - Sauvegarde progressive activée
      </div>

      {feedbackMessage ? (
        <div className={`rounded-md px-4 py-3 text-sm font-semibold ${feedbackTone === "error" ? "bg-[#FDEBEC] text-[#B93840]" : "bg-[#DCECCB] text-[#184D2E]"}`}>
          {feedbackMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr]">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="text-lg font-bold text-[#0F3A63]">Mes missions de l'année</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              L'assistant s'évalue désormais uniquement par mission. Le score final sera la moyenne de toutes les missions notées.
            </p>

            <div className="mt-4 rounded-lg bg-[#F8FAFC] p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Ajouter une mission</p>
              <input
                value={missionTitle}
                onChange={(event) => setMissionTitle(event.target.value)}
                placeholder="Nom ou type de mission"
                className="mt-3 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                <span>Date de début</span>
              </div>
              <input
                type="date"
                value={missionStartDate}
                onChange={(event) => setMissionStartDate(event.target.value)}
                className="mt-2 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-slate-600 outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                <span>Date de fin</span>
              </div>
              <input
                type="date"
                value={missionEndDate}
                min={missionStartDate || undefined}
                onChange={(event) => setMissionEndDate(event.target.value)}
                className="mt-2 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
              />
              <select
                value={effectiveRecipientValue}
                onChange={(event) => {
                  setSelectedRecipientValue(event.target.value);
                  setFeedbackMessage("");
                }}
                className="mt-2 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
              >
                {recipientOptions.map((recipient) => (
                  <option key={getRecipientOptionValue(recipient)} value={getRecipientOptionValue(recipient)}>
                    {recipient.department} - Responsable principal : {getRecipientLabel(recipient)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                Le destinataire choisi recevra seul cette évaluation par mission.
              </p>
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
                  const is = isSameMissionId(MissionId, mission.id);

                  return (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => {
                        setMissionId(mission.id);
                        setMissionSectionIds((current) => ({
                          ...current,
                          [mission.id]: current[mission.id] || mission.criteria[0]?.sectionTitle || "",
                        }));
                        setMissionPageIndexes((current) => ({
                          ...current,
                          [mission.id]: current[mission.id] || 0,
                        }));
                      }}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        is ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                        {mission.createdByRole === "senior" ? (
                          <span className="mt-2 inline-flex rounded-full bg-[#E8F3D6] px-2.5 py-1 text-[10px] font-bold text-[#4E8B1B]">
                            {getMissionAssignmentLabel(mission)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{mission.period}</p>
                      <p className="mt-1 text-xs font-bold text-[#0F4A72]">{getMissionValidationLabel(mission)}</p>
                      <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                        <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#76B82A]">{progress}% complète</p>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-md bg-[#EEF2F6] px-3 py-3 text-sm font-semibold text-slate-500">
                  Aucune mission ajoutée pour le moment.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            {Mission ? (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black leading-tight text-[#0F3A63]">{Mission.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{Mission.period}</p>
                    <p className="mt-1 text-sm font-bold text-[#0F4A72]">Validation : {getMissionValidationLabel(Mission)}</p>
                    {Mission.createdByRole === "senior" ? (
                      <p className="mt-2 text-xs font-semibold text-[#4E8B1B]">
                        Notification : {getMissionAssignmentLabel(Mission)}.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Cette mission sera transmise automatiquement au circuit de validation du département.
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                    Moyenne {MissionAverage} / 5
                  </span>
                </div>

                <section className="mb-4 rounded-md bg-[#F8FAFC] p-4">
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {missionSections.map((section) => {
                      const is = section.id === MissionSection?.id;
                      const progress = getMissionSectionProgress(section);
                      const done = progress === 100;

                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => {
                            setMissionSectionIds((current) => ({
                              ...current,
                              [Mission.id]: section.id,
                            }));
                            setMissionPageIndexes((current) => ({
                              ...current,
                              [Mission.id]: 0,
                            }));
                          }}
                          className={`rounded-md border px-3 py-3 text-left text-white transition ${
                            is
                              ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]"
                              : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-[13px] font-bold">{section.title}</h4>
                            {done ? <Check size={14} className="text-white" /> : null}
                          </div>
                          <p className="text-[12px] font-semibold">{section.groups.length} titre(s)</p>
                          <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                            <div className={`h-1.5 rounded-full ${done ? "bg-[#7BC443]" : "bg-[#D6DCE2]"}`} style={{ width: `${progress}%` }} />
                          </div>
                          <p className="mt-1.5 text-[10px] font-semibold text-slate-200">
                            {done ? "Complète" : progress ? `En cours - ${progress}%` : "À faire"}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-500">Pagination dans la mission</p>
                      <h4 className="text-[16px] font-bold text-[#0F3A63]">{MissionSection?.title}</h4>
                    </div>
                    <span className="text-[12px] font-semibold text-[#0F3A63]">
                      Titre {MissionPageIndex + 1} / {MissionSection?.groups?.length || 1}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(MissionSection?.groups || []).map((group, index) => {
                      const is = index === MissionPageIndex;
                      const progress = getMissionGroupProgress(group);

                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() =>
                            setMissionPageIndexes((current) => ({
                              ...current,
                              [Mission.id]: index,
                            }))
                          }
                          className={`rounded-md border px-3 py-2 text-left transition ${
                            is
                              ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]"
                              : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <p className="text-[11px] font-bold">Titre {index + 1}</p>
                          <p className="mt-1 text-[12px] font-semibold">{group.pageTitle}</p>
                          {shouldShowSourceLabel && group.sourceSheet !== "TRONC COMMUN" && (group.sourceLabel || getSourceBadgeLabel({ source_sheet: group.sourceSheet })) ? (
                            <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2 py-0.5 text-[10px] font-semibold text-[#0F3A63]">
                              {group.sourceLabel || getSourceBadgeLabel({ source_sheet: group.sourceSheet })}
                            </span>
                          ) : null}
                          <p className="mt-1 text-[10px] font-semibold text-[#76B82A]">{progress}%</p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {MissionGroup ? (
                  <div className="space-y-3.5">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500">{MissionGroup.sectionTitle}</p>
                      <p className="mt-1 text-[15px] font-bold text-[#0F3A63]">{MissionGroup.pageTitle}</p>
                      {shouldShowSourceLabel && MissionGroup.sourceSheet !== "TRONC COMMUN" && (MissionGroup.sourceLabel || getSourceBadgeLabel({ source_sheet: MissionGroup.sourceSheet })) ? (
                        <span className="mt-2 inline-flex rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[11px] font-semibold text-[#0F3A63]">
                          {MissionGroup.sourceLabel || getSourceBadgeLabel({ source_sheet: MissionGroup.sourceSheet })}
                        </span>
                      ) : null}
                    </div>
                    {MissionGroup.criteria.map((item) => (
                      <MissionScoreRow
                        key={item.id}
                        themeCode={item.themeCode}
                        label={item.label}
                        statement={item.statement}
                        selected={item.score}
                        onSelect={(score) => updateMissionScore(item.id, score)}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire de section obligatoire</p>
                  <textarea
                    rows={4}
                    value={MissionSection?.comment || ""}
                    onChange={(event) => updateMissionSectionComment(event.target.value)}
                    placeholder="Décrire les faits marquants de cette section..."
                    className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                  />
                </div>

                <div className="mt-5 flex justify-end">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => goToMissionStep(-1)}
                      disabled={MissionSectionIndex === 0 && MissionPageIndex === 0}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft size={14} />
                      Précédent
                    </button>
                    {!isLastMissionStep ? (
                      <button
                        type="button"
                        onClick={() => goToMissionStep(1)}
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
                          disabled={isSaving || isSubmitting || Mission?.status === "Soumise"}
                          className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                        >
                          {isSubmitting ? "Soumission..." : "Soumettre la mission"}
                        </button>
                        <button
                          type="button"
                          onClick={() => persistMissionEvaluations(missionEvaluations)}
                          className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
                        >
                          Enregistrer la mission
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-[#EEF2F6] p-5 text-sm font-semibold text-slate-500">
                Ajoutez une mission pour commencer votre auto-évaluation par mission.
              </div>
            )}
          </article>
 
          <div className="space-y-4">
            <article className="rounded-md bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-bold text-[#0F3A63]">Synthèse de l'évaluation</h3>
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

              <div className="mt-4 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
                La soumission finale est possible quand chaque mission a été soumise à son destinataire.
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => persistMissionEvaluations(missionEvaluations)}
                    disabled={isSaving || isSubmitting}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 disabled:opacity-70"
                  >
                    {isSaving ? "Sauvegarde..." : "Enregistrer"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      isSaving ||
                      isSubmitting ||
                      evaluationData?.evaluation?.status === "Soumis aux Managers" ||
                      evaluationData?.evaluation?.status === "Soumis à la RH"
                    }
                    className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                  >
                    {isSubmitting ? "Soumission..." : "Finaliser l'évaluation"}
                  </button>
                </div>
              </div>
            </article>

            <div className="space-y-4">
              <article className="rounded-md bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-[22px] font-bold text-[#0F3A63]">Missions prêtes</h3>
                <div className="space-y-3">
                  {missionEvaluations.length ? (
                    missionEvaluations.map((mission) => (
                      <div key={mission.id} className="flex items-center justify-between text-[12px]">
                        <div>
                          <p className="font-semibold text-[#0F3A63]">{mission.title}</p>
                          <p className="text-[11px] text-slate-500">{mission.period}</p>
                        </div>
                        <span className="font-bold text-[#76B82A]">
                          {mission.status === "Soumise" ? "Soumise" : `${getMissionProgress(mission)}%`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-slate-500">
                      Aucune mission ajoutée pour le moment.
                    </p>
                  )}
                </div>
              </article>

              <article className="rounded-md bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Destinataires</h3>
                <div className="space-y-2">
                  {managerRecipients.length ? (
                    managerRecipients.map((recipient) => (
                      <div key={`${recipient.department}-${recipient.manager}`} className="rounded-md bg-[#F8FAFC] px-3 py-3">
                        <p className="text-[12px] font-bold text-[#0F3A63]">{recipient.manager}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{recipient.department}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-slate-500">
                      Les destinataires apparaîtront ici dès qu'une mission sera ajoutée.
                    </p>
                  )}
                </div>
              </article>

              <article className="rounded-md bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Aide à la notation</h3>
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
          </div>
      </section>
    </div>
  );
}

export default Monautoevaluation;
