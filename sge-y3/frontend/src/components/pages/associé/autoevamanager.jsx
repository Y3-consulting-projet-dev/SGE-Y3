import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAssociateManagerEvaluation,
  getAssociateManagerEvaluations,
  getReceivedAssociateEvaluation,
  getReceivedAssociateEvaluations,
  saveAssociateManagerEvaluation,
  saveReceivedAssociateEvaluationComment,
  submitAssociateManagerEvaluationToRh,
  submitReceivedAssociateEvaluationToRh,
} from "@/lib/associateOverview";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";

function formatScore(score) {
  return typeof score === "number" ? `${score.toFixed(1)}/5` : "--";
}

function formatCompactScore(score) {
  return typeof score === "number" ? `${score.toFixed(1)} / 5` : "--";
}

function formatDisplayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function scoreTone(score) {
  if (typeof score !== "number") return "text-[#0F3A63]";
  if (score >= 4) return "text-[#78B843]";
  if (score < 3) return "text-[#C53B3B]";
  return "text-[#0F3A63]";
}

function buildMissionsPayload(missions = []) {
  return missions.map((mission) => ({
    id: mission.id,
    title: mission.title,
    period: mission.period,
    department: mission.department,
    average: mission.average,
    comment: mission.comment || "",
    criteria: (mission.criteria || []).map((criterion) => ({
      id: criterion.id,
      sectionTitle: criterion.sectionTitle,
      sectionComment: criterion.sectionComment || "",
      pageTitle: criterion.pageTitle,
      pageComment: criterion.pageComment || "",
      sourceSheet: criterion.sourceSheet,
      sourceLabel: criterion.sourceLabel,
      themeCode: criterion.themeCode,
      label: criterion.label,
      statement: criterion.statement,
      score: criterion.score,
    })),
  }));
}

function getAverage(scores = []) {
  const numericScores = scores.filter((score) => typeof score === "number");
  if (!numericScores.length) return null;
  return numericScores.reduce((total, score) => total + score, 0) / numericScores.length;
}

function getMissionAverage(mission) {
  return getAverage((mission?.criteria || []).map((criterion) => criterion.score));
}

function getMissionProgress(mission) {
  const criteria = mission?.criteria || [];
  if (!criteria.length) return 0;
  const completed = criteria.filter((criterion) => typeof criterion.score === "number").length;
  return Math.round((completed / criteria.length) * 100);
}

function buildManagerMissionPages(mission) {
  const pageMap = new Map();

  (mission?.criteria || []).forEach((criterion, index) => {
    const sectionTitle = criterion.sectionTitle || "Mission";
    const pageTitle = criterion.pageTitle || criterion.label || `Titre ${index + 1}`;
    const key = `${sectionTitle}::${pageTitle}::${criterion.sourceSheet || ""}`;

    if (!pageMap.has(key)) {
      pageMap.set(key, {
        id: key,
        sectionTitle,
        title: pageTitle,
        criteria: [],
      });
    }

    pageMap.get(key).criteria.push({
      ...criterion,
      criteriaIndex: index,
    });
  });

  return Array.from(pageMap.values());
}

function getMissionsAverage(missions = []) {
  return getAverage(missions.map((mission) => getMissionAverage(mission)));
}

function getMissionLabel(mission) {
  const type = mission?.department || "Mission";
  const title = mission?.title || "Sans titre";
  return `${type} - ${title}`;
}

function getMissionKey(mission, index = 0) {
  return String(mission?.id || mission?.mission_id || `mission-${index + 1}`).trim();
}

function getSectionsForMission(sections = [], missionKey = "", missionsCount = 0) {
  const keyedSections = sections.filter((section) => String(section.subtitle || "") === String(missionKey));
  if (keyedSections.length) return keyedSections;

  if (missionsCount <= 1) return sections;

  return [];
}

function buildPagesFromCriteria(section) {
  const pageMap = new Map();

  (section?.criteria || []).forEach((criterion, index) => {
    const pageTitle = criterion.pageTitle || criterion.page_title || criterion.label || `Titre ${index + 1}`;
    const pageKey = `${pageTitle}::${criterion.sourceSheet || criterion.source_sheet || ""}`;

    if (!pageMap.has(pageKey)) {
      pageMap.set(pageKey, {
        page_id: criterion.pageId || criterion.page_id || `${section.id || section.section_id || "section"}-${pageMap.size + 1}`,
        title: pageTitle,
        source_sheet: criterion.sourceSheet || criterion.source_sheet || "",
        source_label: criterion.sourceLabel || criterion.source_label || "",
        comment: criterion.pageComment || criterion.page_comment || "",
        themes: [],
      });
    }

    pageMap.get(pageKey).themes.push({
      theme_id: criterion.id || criterion.criterion_id || `${pageMap.get(pageKey).page_id}-${index + 1}`,
      code: criterion.themeCode || criterion.theme_code || `${pageMap.get(pageKey).themes.length + 1}`,
      label: criterion.label || "",
      statement: criterion.statement || "",
      score: typeof criterion.score === "number" ? criterion.score : null,
      required: criterion.required !== false,
    });
  });

  return Array.from(pageMap.values());
}

function buildBlankSectionsFromMission(mission = {}, missionKey = "", sectionBase = 0) {
  const sectionMap = new Map();

  (mission.criteria || []).forEach((criterion, index) => {
    const sectionTitle = criterion.sectionTitle || criterion.section_title || "Mission";
    const pageTitle = criterion.pageTitle || criterion.page_title || criterion.label || `Titre ${index + 1}`;
    const sectionKey = String(sectionTitle || "Mission");

    if (!sectionMap.has(sectionKey)) {
      const sectionId = sectionBase + sectionMap.size + 1;
      sectionMap.set(sectionKey, {
        id: sectionId,
        section_id: sectionId,
        title: sectionTitle,
        subtitle: missionKey,
        status: "En cours",
        comment: "",
        pages: new Map(),
      });
    }

    const section = sectionMap.get(sectionKey);
    const pageKey = `${pageTitle}::${criterion.sourceSheet || criterion.source_sheet || ""}`;
    if (!section.pages.has(pageKey)) {
      section.pages.set(pageKey, {
        page_id: `${section.id}-${section.pages.size + 1}`,
        title: pageTitle,
        source_sheet: criterion.sourceSheet || criterion.source_sheet || "",
        source_label: criterion.sourceLabel || criterion.source_label || "",
        comment: "",
        themes: [],
      });
    }

    const page = section.pages.get(pageKey);
    page.themes.push({
      theme_id: `${page.page_id}-${page.themes.length + 1}`,
      code: criterion.themeCode || criterion.theme_code || `${page.themes.length + 1}`,
      label: criterion.label || "",
      statement: criterion.statement || "",
      score: null,
      required: true,
    });
  });

  return Array.from(sectionMap.values()).map((section) => ({
    ...section,
    pages: Array.from(section.pages.values()),
  }));
}

function hydrateReceivedSections(sections = [], missions = []) {
  const firstMissionKey = missions[0] ? getMissionKey(missions[0], 0) : "";
  const shouldApplySingleMissionKey = missions.length === 1 && firstMissionKey;

  return sections.map((section) => {
    const pages = section.pages?.length ? section.pages : buildPagesFromCriteria(section);

    return {
      ...section,
      subtitle: shouldApplySingleMissionKey ? firstMissionKey : section.subtitle || "",
      pages,
    };
  });
}

function ensureReceivedSectionsForMissions(sections = [], missions = []) {
  const nextSections = [...sections];

  missions.forEach((mission, index) => {
    const missionKey = getMissionKey(mission, index);
    const hasMissionSections = nextSections.some((section) => String(section.subtitle || "") === String(missionKey));

    if (!hasMissionSections) {
      nextSections.push(...buildBlankSectionsFromMission(mission, missionKey, (index + 1) * 100));
    }
  });

  return nextSections;
}

function getMissionResultRows(missionResults = [], missionKey = "") {
  return (
    missionResults.find(
      (item) =>
        String(item.missionId || "").trim() === String(missionKey || "").trim() ||
        String(item.missionKey || "").trim() === String(missionKey || "").trim()
    )?.results || []
  );
}

function getCandidateSectionComment(mission, sectionTitle = "") {
  const matchingCriterion = (mission?.criteria || []).find(
    (criterion) => String(criterion.sectionTitle || "") === String(sectionTitle || "") && String(criterion.sectionComment || "").trim()
  );

  return matchingCriterion?.sectionComment || "";
}

function getSectionsWithMissingComments(sections = []) {
  return sections.filter((section) => String(section.comment || "").trim().length < 3);
}

function getPageProgress(page) {
  const themes = page?.themes || [];
  if (!themes.length) return 0;
  const answered = themes.filter((theme) => typeof theme.score === "number").length;
  return Math.round((answered / themes.length) * 100);
}

function getSectionProgress(section) {
  const pages = section?.pages || [];
  const totalThemes = pages.reduce((total, page) => total + (page.themes?.length || 0), 0);
  if (!totalThemes) return 0;
  const answeredThemes = pages.reduce(
    (total, page) => total + (page.themes || []).filter((theme) => typeof theme.score === "number").length,
    0
  );
  return Math.round((answeredThemes / totalThemes) * 100);
}

function Autoevamanager() {
  const [listData, setListData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState("");
  const [associateMissions, setAssociateMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [managerMissionPageIndexes, setManagerMissionPageIndexes] = useState({});
  const [receivedEvaluations, setReceivedEvaluations] = useState([]);
  const [activeView, setActiveView] = useState("managers");
  const [selectedReceivedId, setSelectedReceivedId] = useState("");
  const [receivedDetail, setReceivedDetail] = useState(null);
  const [receivedSections, setReceivedSections] = useState([]);
  const [receivedSectionId, setReceivedSectionId] = useState("");
  const [selectedReceivedMissionId, setSelectedReceivedMissionId] = useState("");
  const [receivedPageIndexes, setReceivedPageIndexes] = useState({});
  const [receivedActionMessage, setReceivedActionMessage] = useState("");
  const [receivedActionType, setReceivedActionType] = useState("info");
  const [isReceivedSaving, setIsReceivedSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadManagers() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const [response, receivedResponse] = await Promise.all([
          getAssociateManagerEvaluations(),
          getReceivedAssociateEvaluations("direct-collaborators"),
        ]);

        if (cancelled) return;
        setListData(response);
        setReceivedEvaluations(receivedResponse?.items || []);
        setSelectedManagerId(response?.items?.[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des managers impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadManagers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedManagerId) {
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        setIsDetailLoading(true);
        setErrorMessage("");
        setStatus("");
        const response = await getAssociateManagerEvaluation(selectedManagerId);

        if (cancelled) return;
        const nextMissions = buildMissionsPayload(response?.associate_review?.missions || []);
        setDetailData(response);
        setAssociateMissions(nextMissions);
        setSelectedMissionId(nextMissions[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement du détail impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedManagerId]);

  useEffect(() => {
    if (!selectedReceivedId) {
      return;
    }

    let cancelled = false;

    async function loadReceivedDetail() {
      try {
        setStatus("");
        const response = await getReceivedAssociateEvaluation(selectedReceivedId);
        if (cancelled) return;

        const nextMissions = response.evaluation?.missions || [];
        const nextSections = ensureReceivedSectionsForMissions(
          hydrateReceivedSections(response.peerReview?.sections || [], nextMissions),
          nextMissions
        );
        const firstMissionKey = nextMissions[0] ? getMissionKey(nextMissions[0], 0) : "";
        const firstMissionSections = getSectionsForMission(nextSections, firstMissionKey, nextMissions.length);
        setReceivedDetail(response);
        setReceivedSections(nextSections);
        setSelectedReceivedMissionId(firstMissionKey);
        setReceivedSectionId(firstMissionSections[0]?.id || nextSections[0]?.id || "");
        setReceivedPageIndexes({});
        setReceivedActionMessage("");
        setReceivedActionType("info");
      } catch (error) {
        if (!cancelled) {
          setStatus(error.message || "Chargement de l'évaluation reçue impossible.");
        }
      }
    }

    loadReceivedDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedReceivedId]);

  useEffect(() => {
    if (activeView === "received" && !selectedReceivedId && receivedEvaluations[0]?.id) {
      setSelectedReceivedId(receivedEvaluations[0].id);
    }
  }, [activeView, receivedEvaluations, selectedReceivedId]);

  const items = useMemo(() => listData?.items || [], [listData?.items]);
  const selectedManager = items.find((item) => item.id === selectedManagerId) || null;
  const selfMissions = detailData?.self_evaluation?.missions || [];
  const receivedMissionsTotal = receivedEvaluations.reduce(
    (total, evaluation) => total + Number(evaluation.receivedMissionsCount || 0),
    0
  );

  const currentMissionIndex = Math.max(0, associateMissions.findIndex((mission) => mission.id === selectedMissionId));
  const currentMission = associateMissions[currentMissionIndex] || null;
  const currentSelfMission = selfMissions[currentMissionIndex] || null;
  const currentMissionProgress = getMissionProgress(currentMission);
  const managerMissionPages = useMemo(() => buildManagerMissionPages(currentMission), [currentMission]);
  const managerMissionPageIndex = Math.min(
    managerMissionPageIndexes[selectedMissionId] || 0,
    Math.max(managerMissionPages.length - 1, 0)
  );
  const currentManagerMissionPage = managerMissionPages[managerMissionPageIndex] || null;
  const isLastManagerMissionPage =
    managerMissionPages.length > 0 && managerMissionPageIndex >= managerMissionPages.length - 1;
  const currentManagerSectionTitle = currentManagerMissionPage?.sectionTitle || "";
  const currentManagerSectionComment = useMemo(() => {
    const matchingCriterion = (currentMission?.criteria || []).find(
      (criterion) => String(criterion.sectionTitle || "") === String(currentManagerSectionTitle || "")
    );

    return matchingCriterion?.sectionComment || "";
  }, [currentMission, currentManagerSectionTitle]);
  const receivedMissions = receivedDetail?.evaluation?.missions || [];
  const selectedReceivedMissionIndex = Math.max(
    0,
    receivedMissions.findIndex((mission, index) => getMissionKey(mission, index) === selectedReceivedMissionId)
  );
  const selectedReceivedMission = receivedMissions[selectedReceivedMissionIndex] || null;
  const selectedReceivedMissionKey = selectedReceivedMission
    ? getMissionKey(selectedReceivedMission, selectedReceivedMissionIndex)
    : "";
  const currentReceivedSections = useMemo(
    () => getSectionsForMission(receivedSections, selectedReceivedMissionKey, receivedMissions.length),
    [receivedSections, selectedReceivedMissionKey, receivedMissions.length]
  );
  const selectedReceivedMissionResults = useMemo(
    () => getMissionResultRows(receivedDetail?.evaluation?.missionResults || [], selectedReceivedMissionKey),
    [receivedDetail?.evaluation?.missionResults, selectedReceivedMissionKey]
  );
  const receivedSection =
    currentReceivedSections.find((section) => String(section.id) === String(receivedSectionId)) ||
    currentReceivedSections[0] ||
    null;
  const receivedPageIndex = receivedPageIndexes[receivedSection?.id] || 0;
  const receivedPage = receivedSection?.pages?.[receivedPageIndex] || receivedSection?.pages?.[0] || null;
  const candidateSectionComment = getCandidateSectionComment(selectedReceivedMission, receivedSection?.title);
  const receivedPagesCount = receivedSection?.pages?.length || 0;
  const receivedSectionIndex = Math.max(
    0,
    currentReceivedSections.findIndex((section) => String(section.id) === String(receivedSection?.id))
  );
  const isLastReceivedPage = receivedPagesCount > 0 && receivedPageIndex >= receivedPagesCount - 1;
  const isLastReceivedSection =
    currentReceivedSections.length > 0 && receivedSectionIndex >= currentReceivedSections.length - 1;
  const canSubmitReceivedToRh = isLastReceivedSection && isLastReceivedPage;

  const kpis = useMemo(() => {
    const total = items.length;

    return [
      { title: "Managers / senior managers", value: `${total}`, subtitle: "Tous les profils actifs de la base", action: "managers" },
      {
        title: "Évaluations reçues",
        value: `${receivedMissionsTotal}`,
        subtitle: "Missions d'auto-évaluation transmises aux associés",
        action: "received",
      },
    ];
  }, [items, receivedMissionsTotal]);

  const setMissionCriterionScore = (criterionId, score) => {
    setAssociateMissions((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id !== selectedMissionId
          ? mission
          : {
              ...mission,
              criteria: (mission.criteria || []).map((criterion) =>
                criterion.id === criterionId ? { ...criterion, score } : criterion
              ),
            }
      )
    );
    setStatus("");
  };

  const setReceivedThemeScore = (themeId, score) => {
    setReceivedSections((currentSections) =>
      currentSections.map((section) =>
        String(section.id) !== String(receivedSection?.id) ||
        String(section.subtitle || "") !== String(selectedReceivedMissionKey || "")
          ? section
          : {
              ...section,
              pages: (section.pages || []).map((page, pageIndex) =>
                pageIndex !== receivedPageIndex
                  ? page
                  : {
                      ...page,
                      themes: (page.themes || []).map((theme) =>
                        String(theme.theme_id) === String(themeId) ? { ...theme, score } : theme
                      ),
                    }
              ),
            }
      )
    );
    setStatus("");
    setReceivedActionMessage("");
    setReceivedActionType("info");
  };

  const setReceivedSectionComment = (comment) => {
    setReceivedSections((currentSections) =>
      currentSections.map((section) =>
        String(section.id) === String(receivedSection?.id) &&
        String(section.subtitle || "") === String(selectedReceivedMissionKey || "")
          ? { ...section, comment }
          : section
      )
    );
    setStatus("");
    setReceivedActionMessage("");
    setReceivedActionType("info");
  };

  const validateCurrentManagerSectionComment = () => {
    if (String(currentManagerSectionComment || "").trim().length >= 3) {
      return true;
    }

    setStatus("Le commentaire de la section est obligatoire avant de continuer.");
    return false;
  };

  const validateAllManagerSectionComments = () => {
    const sectionComments = new Map();

    (currentMission?.criteria || []).forEach((criterion) => {
      const sectionTitle = criterion.sectionTitle || "Mission";
      if (!sectionComments.has(sectionTitle)) {
        sectionComments.set(sectionTitle, "");
      }

      const comment = String(criterion.sectionComment || "").trim();
      if (comment) {
        sectionComments.set(sectionTitle, comment);
      }
    });

    const hasMissingComment = Array.from(sectionComments.values()).some((comment) => comment.length < 3);
    if (!hasMissingComment) {
      return true;
    }

    setStatus("Un commentaire est obligatoire pour chaque section avant transmission à la RH.");
    return false;
  };

  const validateCurrentManagerMissionPage = () => {
    const missingScore = (currentManagerMissionPage?.criteria || []).some((criterion) => typeof criterion.score !== "number");
    if (!missingScore) {
      return true;
    }

    setStatus("Toutes les notes de la page en cours doivent être renseignées.");
    return false;
  };

  const saveEvaluation = async () => {
    if (!selectedManagerId) return false;

    try {
      const response = await saveAssociateManagerEvaluation(selectedManagerId, {
        missions: associateMissions,
      });

      const nextMissions = buildMissionsPayload(response?.associate_review?.missions || []);

      setDetailData(response);
      setAssociateMissions(nextMissions);
      setStatus("Évaluation associé enregistrée.");
      setListData((current) => ({
        ...current,
        items: (current?.items || []).map((item) =>
          item.id === selectedManagerId
            ? {
                ...item,
                associateMissionScore: getMissionsAverage(nextMissions),
              }
            : item
        ),
      }));
    } catch (error) {
      setStatus(error.message || "Enregistrement impossible.");
      return false;
    }

    return true;
  };

  const saveManagerMissionAndContinue = async () => {
    if (!validateCurrentManagerMissionPage()) return;
    if (!validateCurrentManagerSectionComment()) return;

    const saved = await saveEvaluation();
    if (!saved || !currentMission?.id) return;

    if (!isLastManagerMissionPage) {
      setManagerMissionPageIndexes((current) => ({
        ...current,
        [currentMission.id]: managerMissionPageIndex + 1,
      }));
    }
  };

  const submitManagerEvaluationToRh = async () => {
    if (!selectedManagerId) return;
    if (!validateCurrentManagerMissionPage()) return;
    if (!validateCurrentManagerSectionComment()) return;
    if (!validateAllManagerSectionComments()) return;

    try {
      const response = await submitAssociateManagerEvaluationToRh(selectedManagerId, {
        missions: associateMissions,
      });
      const nextMissions = buildMissionsPayload(response?.associate_review?.missions || []);

      setDetailData(response);
      setAssociateMissions(nextMissions);
      setStatus("Évaluation du manager transmise à la RH.");
      setListData((current) => ({
        ...current,
        items: (current?.items || []).map((item) =>
          item.id === selectedManagerId
            ? {
                ...item,
                associateMissionScore: getMissionsAverage(nextMissions),
              }
            : item
        ),
      }));
    } catch (error) {
      setStatus(error.message || "Transmission à la RH impossible.");
    }
  };

  const saveReceivedEvaluation = async ({ silent = false } = {}) => {
    if (!selectedReceivedId) return false;

    try {
      setIsReceivedSaving(true);
      const response = await saveReceivedAssociateEvaluationComment(selectedReceivedId, {
        sections: receivedSections,
      });
      const responseMissions = response.evaluation?.missions || receivedMissions;
      const nextSections = ensureReceivedSectionsForMissions(
        hydrateReceivedSections(response.peerReview?.sections || [], responseMissions),
        responseMissions
      );
      setReceivedDetail(response);
      setReceivedSections(nextSections);
      setReceivedEvaluations((current) =>
        current.map((item) =>
          item.id === selectedReceivedId
            ? {
                ...item,
                commentSaved: true,
                peerReviewAverage: response.peerReview?.summary?.overallAverage,
              }
            : item
          )
      );
      setStatus(silent ? "Progression sauvegardée." : response.message || "Évaluation reçue enregistrée.");
      return true;
    } catch (error) {
      setStatus(error.message || "Enregistrement de l'évaluation reçue impossible.");
      return false;
    } finally {
      setIsReceivedSaving(false);
    }
  };

  const getMissingReceivedSectionComments = () => getSectionsWithMissingComments(currentReceivedSections);

  const goToReceivedPage = async (nextPageIndex) => {
    if (!receivedSection) return;

    const saved = await saveReceivedEvaluation({ silent: true });
    if (!saved) return;

    setReceivedPageIndexes((current) => ({
      ...current,
      [receivedSection.id]: nextPageIndex,
    }));
  };

  const continueReceivedEvaluation = async () => {
    if (!receivedSection) return;

    if (String(receivedSection?.comment || "").trim().length < 3) {
      setReceivedActionMessage("Le commentaire de section d'au moins 3 caractères est obligatoire avant de continuer.");
      setReceivedActionType("error");
      return;
    }

    if (!isLastReceivedPage) {
      await goToReceivedPage(Math.min(receivedPagesCount - 1, receivedPageIndex + 1));
      return;
    }

    const nextSection = currentReceivedSections[receivedSectionIndex + 1];
    if (!nextSection) return;

    const saved = await saveReceivedEvaluation({ silent: true });
    if (!saved) return;

    setReceivedSectionId(nextSection.id);
    setReceivedPageIndexes((current) => ({
      ...current,
      [nextSection.id]: 0,
    }));
  };

  const submitReceivedEvaluationToRh = async () => {
    if (!selectedReceivedId) return;

    try {
      const missingComments = getMissingReceivedSectionComments();
      if (missingComments.length) {
        setReceivedActionMessage(
          `Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant la transmission à la RH : ${missingComments
            .map((section) => section.title)
            .join(', ')}.`
        );
        setReceivedActionType("error");
        return;
      }

      setIsReceivedSaving(true);
      const savedResponse = await saveReceivedAssociateEvaluationComment(selectedReceivedId, {
        sections: receivedSections,
      });
      const savedMissions = savedResponse.evaluation?.missions || receivedMissions;
      const savedSections = ensureReceivedSectionsForMissions(
        hydrateReceivedSections(savedResponse.peerReview?.sections || [], savedMissions),
        savedMissions
      );
      setReceivedDetail(savedResponse);
      setReceivedSections(savedSections);

      const response = await submitReceivedAssociateEvaluationToRh(selectedReceivedId);
      const responseMissions = response.evaluation?.missions || receivedMissions;
      const responseSections = ensureReceivedSectionsForMissions(
        hydrateReceivedSections(response.peerReview?.sections || [], responseMissions),
        responseMissions
      );
      setReceivedDetail(response);
      setReceivedSections(responseSections);
      setReceivedEvaluations((current) =>
        current.map((item) =>
          item.id === selectedReceivedId
            ? {
                ...item,
                status: response.evaluation?.status || item.status,
              }
            : item
        )
      );
      setStatus(response.message || "Évaluation transmise à la RH.");
      setReceivedActionMessage(response.message || "Évaluation transmise à la RH.");
      setReceivedActionType("success");
    } catch (error) {
      const message = error.message || "Transmission à la RH impossible.";
      setStatus(message);
      setReceivedActionMessage(message);
      setReceivedActionType("error");
    } finally {
      setIsReceivedSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement des managers...
      </section>
    );
  }

  if (errorMessage && !items.length && !detailData) {
    return (
      <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
        {errorMessage}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-black tracking-tight text-[#0F3A63]">Évaluations par mission des managers</h1>
        <p className="text-xs font-semibold text-slate-500">
          L'associé évalue ici les managers et senior managers uniquement sur les missions transmises.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {kpis.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => {
              if (item.action) {
                setActiveView(item.action);
                if (item.action === "received" && !selectedReceivedId && receivedEvaluations[0]?.id) {
                  setSelectedReceivedId(receivedEvaluations[0].id);
                }
              }
            }}
            className={`rounded-lg bg-[#0D496A] p-4 text-left text-white ${
              activeView === item.action ? "ring-2 ring-[#76B82A]" : ""
            } ${item.action ? "transition hover:bg-[#0F557A]" : "cursor-default"}`}
          >
            <p className="text-xs font-semibold">{item.title}</p>
            <p className="mt-3 text-xl font-extrabold leading-none">{item.value}</p>
            <p className="mt-3 text-xs font-semibold text-slate-100">{item.subtitle}</p>
          </button>
        ))}
      </section>

      {activeView === "managers" ? (
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
          <div>
            <aside className="rounded-xl bg-[#F4F7FB] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-[#0F3A63]">Sélection du manager</h2>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">
                  {items.length} profil(s)
                </span>
              </div>

              <label className="mt-4 block text-sm font-bold text-[#0F3A63]">
                Filtrer / sélectionner
                <select
                  value={selectedManagerId}
                  onChange={(event) => setSelectedManagerId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-[#0F3A63] outline-none"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {item.department}
                    </option>
                  ))}
                </select>
              </label>

              {selectedManager ? (
                <div className="mt-4 rounded-xl border border-[#8BC43F] bg-[#F1F8E8] p-4">
                  <p className="text-base font-extrabold text-[#0F3A63]">{selectedManager.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {selectedManager.grade} - {selectedManager.department}
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs font-bold text-[#0F4A72]">Missions</p>
                      <p className={`mt-2 text-lg font-black ${scoreTone(selectedManager.associateMissionScore)}`}>
                        {formatScore(selectedManager.associateMissionScore)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs font-semibold">
                    <p className={selectedManager.missionsCount ? "text-[#78B843]" : "text-slate-500"}>
                      {selectedManager.missionsCount ? `${selectedManager.missionsCount} mission(s) à évaluer` : "Aucune mission transmise à l'associé pour l'instant"}
                    </p>
                  </div>
                </div>
              ) : null}
            </aside>

            <aside className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-[#0F4A72]">Missions à évaluer</p>
                    <span className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-bold text-[#0F4A72]">
                      {associateMissions.length} mission(s)
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {associateMissions.length ? (
                      associateMissions.map((mission, index) => {
                        const missionProgress = getMissionProgress(mission);

                        return (
                          <button
                            key={mission.id}
                            onClick={() => setSelectedMissionId(mission.id)}
                            className={`w-full rounded-lg border p-3 text-left ${
                              selectedMissionId === mission.id ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                              <span className="text-xs font-bold text-slate-500">{index + 1}</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {mission.period} - {mission.department}
                            </p>
                            <p className={`mt-2 text-xs font-bold ${scoreTone(getMissionAverage(mission))}`}>
                              Associé : {formatScore(getMissionAverage(mission))}
                            </p>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${getProgressBarClass(missionProgress)}`}
                                style={{ width: `${clampProgress(missionProgress)}%` }}
                              />
                            </div>
                            <p className={`mt-1 text-xs font-bold ${getProgressToneClass(missionProgress)}`}>
                              {missionProgress}% complétée
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm font-semibold text-slate-500">
                        Aucune mission transmise à l'associé pour ce manager.
                      </p>
                    )}
                  </div>
                </aside>
          </div>



          <div className="rounded-xl bg-[#D4DADF] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[#0F3A63]">Évaluation par mission</h2>

              {selectedManager ? (
                <span className="rounded-full bg-[#E5EFE1] px-4 py-1 text-xs font-semibold text-[#0F4A72]">
                  {selectedManager.name}
                </span>
              ) : null}
            </div>

            {errorMessage && items.length ? (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{errorMessage}</div>
            ) : null}

            {isDetailLoading ? (
              <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500">
                Chargement du détail manager...
              </section>
            ) : (
              <section className="flex">
                <article className="rounded-lg bg-white p-4 shadow-sm">
                  {currentMission ? (
                    <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase text-slate-400">Mission sélectionnée</p>
                          <h3 className="text-lg font-black text-[#0F3A63]">{currentMission.title}</h3>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {currentMission.period} - {currentMission.department}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-full bg-[#F4F7FB] px-3 py-2 text-sm font-bold text-[#0F4A72]">
                          <button
                            onClick={() => setSelectedMissionId(associateMissions[Math.max(currentMissionIndex - 1, 0)]?.id || selectedMissionId)}
                            disabled={currentMissionIndex === 0}
                            className="rounded-full p-1 disabled:opacity-30"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span>
                            Mission {currentMissionIndex + 1} / {associateMissions.length}
                          </span>
                          <button
                            onClick={() =>
                              setSelectedMissionId(
                                associateMissions[Math.min(currentMissionIndex + 1, associateMissions.length - 1)]?.id || selectedMissionId
                              )
                            }
                            disabled={currentMissionIndex >= associateMissions.length - 1}
                            className="rounded-full p-1 disabled:opacity-30"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-[#F7FAFC] p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Auto-évaluation manager</p>
                          <p className={`mt-2 text-xl font-black ${scoreTone(currentSelfMission?.average)}`}>
                            {formatScore(currentSelfMission?.average)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#F7FAFC] p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Score associé</p>
                          <p className={`mt-2 text-xl font-black ${scoreTone(getMissionAverage(currentMission))}`}>
                            {formatScore(getMissionAverage(currentMission))}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#F7FAFC] p-3">
                          <p className="text-xs font-bold uppercase text-slate-400">Progression</p>
                          <p className={`mt-2 text-xl font-black ${getProgressToneClass(currentMissionProgress)}`}>
                            {currentMissionProgress}%
                          </p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${getProgressBarClass(currentMissionProgress)}`}
                              style={{ width: `${clampProgress(currentMissionProgress)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mb-3 rounded-lg bg-[#F7FAFC] p-3">
                        <p className="text-xs font-bold uppercase text-slate-400">
                          {currentManagerMissionPage?.sectionTitle || "Mission"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                          <h4 className="text-base font-black text-[#0F3A63]">
                            {currentManagerMissionPage?.title || "Page d'évaluation"}
                          </h4>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">
                            Page {managerMissionPageIndex + 1} / {managerMissionPages.length || 1}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(currentManagerMissionPage?.criteria || []).map((criterion, index) => {
                          const managerCriterion = (currentSelfMission?.criteria || [])[criterion.criteriaIndex ?? index];

                          return (
                            <div key={criterion.id || index} className="rounded-lg bg-[#F8FAFC] p-3">
                              <div className="mb-2">
                                <p className="text-sm font-bold leading-snug text-[#0F3A63]">{criterion.label}</p>
                                {criterion.pageTitle ? <p className="mt-1 text-xs font-semibold text-slate-500">{criterion.pageTitle}</p> : null}
                              </div>

                              <p className="text-xs leading-6 text-slate-500">{criterion.statement}</p>

                              <p className="mt-3 text-xs font-bold text-[#78B843]">
                                Manager : {managerCriterion?.score ?? "--"}/5
                              </p>

                              <div className="mt-3 flex overflow-hidden rounded-md border border-slate-200">
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={`${criterion.id}-${value}`}
                                    onClick={() => setMissionCriterionScore(criterion.id, value)}
                                    className={`h-9 w-10 border-r border-slate-200 text-sm font-bold last:border-r-0 ${
                                      value === criterion.score ? "bg-[#0C4B6C] text-white" : "bg-white text-[#0F3A63]"
                                    }`}
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-xl bg-[#F7FAFC] p-4">
                        <p className="mb-2 text-sm font-bold text-[#0F4A72]">
                          Commentaire de section associé obligatoire <span className="text-red-600">*</span>
                        </p>
                        <textarea
                          value={currentManagerSectionComment}
                          onChange={(event) => {
                            const nextComment = event.target.value;
                            setAssociateMissions((currentMissions) =>
                              currentMissions.map((mission) =>
                                mission.id === currentMission.id
                                  ? {
                                      ...mission,
                                      criteria: (mission.criteria || []).map((criterion) =>
                                        String(criterion.sectionTitle || "") === String(currentManagerSectionTitle || "")
                                          ? { ...criterion, sectionComment: nextComment }
                                          : criterion
                                      ),
                                    }
                                  : mission
                              )
                            );
                            setStatus("");
                          }}
                          className="min-h-[120px] w-full resize-none rounded-lg bg-[#ECEFF3] px-3 py-3 text-sm text-slate-700 outline-none"
                        />
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              currentMission?.id &&
                              setManagerMissionPageIndexes((current) => ({
                                ...current,
                                [currentMission.id]: Math.max(managerMissionPageIndex - 1, 0),
                              }))
                            }
                            disabled={managerMissionPageIndex === 0}
                            className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-5 py-2 text-sm font-bold text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ChevronLeft size={16} />
                            Précédent
                          </button>

                          <div className="flex flex-wrap gap-3">
                            {isLastManagerMissionPage ? (
                              <button
                                type="button"
                                onClick={submitManagerEvaluationToRh}
                                className="rounded-md bg-[#76B82A] px-5 py-2 text-sm font-bold text-white"
                              >
                                Soumettre à la RH
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={saveManagerMissionAndContinue}
                                className="inline-flex items-center gap-2 rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white"
                              >
                                Sauvegarder et continuer
                                <ChevronRight size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        {status ? <p className="mt-2 text-xs font-semibold text-[#0F4A72]">{status}</p> : null}
                      </div>
                    </>
                  ) : (
                    <p className="rounded-lg bg-white p-4 text-sm font-semibold text-slate-500">
                      Aucune mission disponible pour cette évaluation.
                    </p>
                  )}
                </article>
              </section>
            )}
          </div>
        </div>
      </section>
      ) : null}

      {activeView === "received" ? (
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#0F3A63]">Évaluations reçues</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Collaborateurs évalués directement par les associés avant transmission à la RH.
            </p>
          </div>
          <span className="rounded-full bg-[#EAF5DF] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
            {receivedMissionsTotal} mission(s)
          </span>
        </div>

        {receivedEvaluations.length ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
            <aside className="space-y-4 rounded-lg border border-slate-100 bg-[#F8FAFC] p-4">
              <div>
                <label className="text-sm font-black text-[#0F3A63]" htmlFor="received-collaborator-filter">
                  Filtrer par collaborateur
                </label>
                <select
                  id="received-collaborator-filter"
                  value={selectedReceivedId}
                  onChange={(event) => {
                    setSelectedReceivedId(event.target.value);
                    setSelectedReceivedMissionId("");
                    setReceivedDetail(null);
                  }}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-[#0F3A63] outline-none"
                >
                  {receivedEvaluations.map((evaluation) => (
                    <option key={evaluation.id} value={evaluation.id}>
                      {evaluation.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* {receivedDetail ? (
                <div className="rounded-lg border border-[#76B82A] bg-[#EEF6E8] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#0F3A63]">{receivedDetail.submitter?.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {receivedDetail.submitter?.grade} - {receivedDetail.submitter?.department}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#0F4A72]">
                      {receivedDetail.evaluation?.status || "En attente"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Auto</p>
                      <p className={`mt-1 text-sm font-black ${scoreTone(receivedDetail.summary?.overallAverage)}`}>
                        {formatScore(receivedDetail.summary?.overallAverage)}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Associé</p>
                      <p className={`mt-1 text-sm font-black ${scoreTone(receivedDetail.peerReview?.summary?.overallAverage)}`}>
                        {formatScore(receivedDetail.peerReview?.summary?.overallAverage)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-white p-3 text-sm font-semibold text-slate-500">
                  Chargement des missions du collaborateur...
                </p>
              )} */}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#0F3A63]">Missions soumises</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                    {receivedMissions.length}
                  </span>
                </div>
                {receivedMissions.length ? (
                  <div className="space-y-2">
                    {receivedMissions.map((mission, missionIndex) => {
                      const missionKey = getMissionKey(mission, missionIndex);
                      const isSelectedMission = missionKey === selectedReceivedMissionKey;
                      return (
                        <button
                          key={missionKey}
                          type="button"
                          onClick={() => {
                            const missionSections = getSectionsForMission(receivedSections, missionKey, receivedMissions.length);
                            setSelectedReceivedMissionId(missionKey);
                            setReceivedSectionId(missionSections[0]?.id || "");
                            setReceivedPageIndexes({});
                            setStatus("");
                            setReceivedActionMessage("");
                            setReceivedActionType("info");
                          }}
                          className={`w-full rounded-lg border p-3 text-left transition ${
                            isSelectedMission ? "border-[#76B82A] bg-white" : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <p className="text-sm font-black text-[#0F3A63]">{getMissionLabel(mission)}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {mission.period || "Période non renseignée"}
                          </p>
                          <p className={`mt-2 text-xs font-black ${scoreTone(mission.average)}`}>
                            Auto-évaluation : {formatScore(mission.average)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md bg-white p-3 text-sm font-semibold text-slate-500">
                    Aucune mission soumise pour ce collaborateur.
                  </p>
                )}
              </div>
            </aside>

            <article className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4">
              {receivedDetail && selectedReceivedMission ? (
                <>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-[#0F3A63]">{selectedReceivedMission.title || getMissionLabel(selectedReceivedMission)}</h3>
                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {selectedReceivedMission.period || "Période non renseignée"} - {selectedReceivedMission.department || receivedDetail.submitter?.department}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    {selectedReceivedMissionResults.length ? (
                      selectedReceivedMissionResults.map((result, index) => (
                        <section key={`${result.evaluatorName}-${index}`} className="rounded-lg bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                            <div>
                              <p className="text-sm font-black text-[#0F3A63]">{result.evaluatorName || "Évaluateur"}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{result.evaluatorGrade || "Grade non renseigné"}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-black ${scoreTone(result.score)}`}>{formatCompactScore(result.score)}</p>
                              {formatDisplayDate(result.submittedAt) ? (
                                <p className="mt-1 text-xs font-semibold text-slate-500">{formatDisplayDate(result.submittedAt)}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            {(result.sectionComments || []).length ? (
                              result.sectionComments.map((section) => (
                                <div key={`${result.evaluatorName}-${section.title}`} className="rounded-lg bg-[#F8FAFC] px-4 py-3">
                                  <p className="text-xs font-black uppercase text-[#0F3A63]">{section.title || "Section"}</p>
                                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                                    {section.comment || "Rien à signaler."}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg bg-[#F8FAFC] px-4 py-3">
                                <p className="text-sm font-bold text-slate-600">Aucun commentaire disponible.</p>
                              </div>
                            )}
                          </div>
                        </section>
                      ))
                    ) : (
                      <p className="rounded-lg bg-white p-4 text-sm font-semibold text-slate-500">
                        Aucun résultat d'évaluation n'est disponible pour cette mission.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-lg bg-white p-4 text-sm font-semibold text-slate-500">
                  Sélectionnez une évaluation reçue pour la traiter.
                </p>
              )}
            </article>

            <article className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4 xl:col-start-2">
              {receivedDetail && selectedReceivedMission && receivedPage ? (
                <>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-400">Évaluation de la mission sélectionnée</p>
                      <h3 className="text-xl font-black text-[#0F3A63]">{getMissionLabel(selectedReceivedMission)}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {selectedReceivedMission.period || "Période non renseignée"} - {receivedDetail.submitter?.name}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {currentReceivedSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setReceivedSectionId(section.id)}
                        className={`rounded-md border p-3 text-left ${
                          String(receivedSection?.id) === String(section.id)
                            ? "border-[#76B82A] bg-white"
                            : "border-slate-200 bg-white/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                          <span className={`text-xs font-bold ${getProgressToneClass(getSectionProgress(section))}`}>
                            {getSectionProgress(section)}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mb-4 rounded-lg bg-white p-3">
                    <p className="mb-2 text-xs font-extrabold text-[#0F4A72]">Titres</p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {(receivedSection?.pages || []).map((page, index) => (
                        <button
                          key={page.page_id}
                          type="button"
                          onClick={() => setReceivedPageIndexes((current) => ({ ...current, [receivedSection.id]: index }))}
                          className={`rounded-md border p-2 text-left ${
                            index === receivedPageIndex ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-200 bg-white"
                          }`}
                        >
                          <p className="text-[10px] font-bold text-[#0F3A63]">Titre {index + 1}</p>
                          <p className="mt-1 text-xs font-semibold text-[#0F3A63]">{page.title}</p>
                          <p className={`mt-1 text-[10px] font-bold ${getProgressToneClass(getPageProgress(page))}`}>
                            {getPageProgress(page)}%
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 rounded-lg bg-white p-3">
                    <p className="text-[11px] font-bold uppercase text-slate-400">Commentaire du candidat pour cette section</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                      {candidateSectionComment || "Aucun commentaire de section disponible."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(receivedPage.themes || []).map((theme) => (
                      <div key={theme.theme_id} className="rounded-lg bg-white p-3">
                        <p className="text-sm font-bold text-[#0F3A63]">{theme.label}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-500">{theme.statement}</p>
                        <div className="mt-3 flex overflow-hidden rounded-md border border-slate-200">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={`${theme.theme_id}-${value}`}
                              type="button"
                              onClick={() => setReceivedThemeScore(theme.theme_id, value)}
                              className={`h-9 w-10 border-r border-slate-200 text-sm font-bold last:border-r-0 ${
                                value === theme.score ? "bg-[#0C4B6C] text-white" : "bg-white text-[#0F3A63]"
                              }`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-sm font-bold text-[#0F4A72]">
                    Commentaire de section de l'associé obligatoire <span className="text-red-600">*</span>
                  </p>
                  <textarea
                    value={receivedSection?.comment || ""}
                    onChange={(event) => setReceivedSectionComment(event.target.value)}
                    placeholder="Commentaire de section de l'associé obligatoire..."
                    className="mt-2 min-h-[100px] w-full resize-none rounded-lg bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => goToReceivedPage(Math.max(0, receivedPageIndex - 1))}
                      disabled={isReceivedSaving || receivedPageIndex <= 0}
                      className="flex items-center gap-2 rounded-md bg-[#EEF2F6] px-5 py-3 text-sm font-bold text-slate-400 disabled:opacity-60"
                    >
                      <ChevronLeft size={16} />
                      Précédent
                    </button>
                    {canSubmitReceivedToRh ? (
                      <button
                        type="button"
                        onClick={submitReceivedEvaluationToRh}
                        disabled={isReceivedSaving || receivedDetail.evaluation?.status === "Soumis a RH"}
                        className="flex items-center gap-2 rounded-md bg-[#76B82A] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {isReceivedSaving ? "Transmission..." : "Transmettre à la RH"}
                        <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={continueReceivedEvaluation}
                        disabled={isReceivedSaving}
                        className="flex items-center gap-2 rounded-md bg-[#76B82A] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {isReceivedSaving ? "Sauvegarde..." : "Sauvegarder et continuer"}
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                  {receivedActionMessage ? (
                    <p className={`mt-2 text-right text-xs font-bold ${receivedActionType === "success" ? "text-[#76B82A]" : "text-red-600"}`}>
                      {receivedActionMessage}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="rounded-lg bg-white p-4 text-sm font-semibold text-slate-500">
                  Sélectionnez une évaluation reçue pour la traiter.
                </p>
              )}
            </article>
          </div>
        ) : (
          <p className="rounded-lg bg-[#F8FAFC] p-4 text-sm font-semibold text-slate-500">
            Aucune évaluation reçue pour le moment.
          </p>
        )}
      </section>
      ) : null}
    </div>
  );
}

export default Autoevamanager;
