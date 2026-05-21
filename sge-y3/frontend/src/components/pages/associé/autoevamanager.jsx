import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAssociateManagerEvaluation,
  getAssociateManagerEvaluations,
  saveAssociateManagerEvaluation,
} from "@/lib/associateOverview";

function formatScore(score) {
  return typeof score === "number" ? `${score.toFixed(1)}/5` : "--";
}

function scoreTone(score) {
  if (typeof score !== "number") return "text-[#0F3A63]";
  if (score >= 4) return "text-[#78B843]";
  if (score < 3) return "text-[#C53B3B]";
  return "text-[#0F3A63]";
}

function buildSectionsPayload(sections = []) {
  return sections.map((section) => ({
    ...section,
    id: section.id || section.section_id,
    section_id: section.section_id || section.id,
    pages: (section.pages || []).map((page) => ({
      ...page,
      themes: (page.themes || []).map((theme) => ({ ...theme })),
    })),
    criteria: (section.criteria || []).map((criterion) => ({ ...criterion })),
  }));
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
      pageTitle: criterion.pageTitle,
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

function getSectionAverage(section) {
  return getAverage((section?.criteria || []).map((criterion) => criterion.score));
}

function getMissionAverage(mission) {
  return getAverage((mission?.criteria || []).map((criterion) => criterion.score));
}

function getOverallAverage(sections = []) {
  return getAverage(
    sections.flatMap((section) => (section.criteria || []).map((criterion) => criterion.score))
  );
}

function getMissionsAverage(missions = []) {
  return getAverage(missions.map((mission) => getMissionAverage(mission)));
}

function getSectionPages(section) {
  const explicitPages = (section?.pages || []).map((page) => ({
    id: page.page_id,
    title: page.title,
    sourceLabel: page.source_label || page.source_sheet || "",
  }));

  if (explicitPages.length) {
    return explicitPages;
  }

  const uniquePages = new Map();
  (section?.criteria || []).forEach((criterion) => {
    const pageId = criterion.page_id || criterion.pageId || criterion.criterion_id;
    if (!uniquePages.has(pageId)) {
      uniquePages.set(pageId, {
        id: pageId,
        title: criterion.page_title || criterion.pageTitle || criterion.label,
        sourceLabel: criterion.source_label || criterion.sourceLabel || criterion.source_sheet || criterion.sourceSheet || "",
      });
    }
  });

  return Array.from(uniquePages.values());
}

function getPageProgress(section, pageId) {
  const pageCriteria = (section?.criteria || []).filter(
    (criterion) => String(criterion.page_id || criterion.pageId || "") === String(pageId)
  );
  if (!pageCriteria.length) return 0;

  const completedCount = pageCriteria.filter((criterion) => typeof criterion.score === "number").length;
  return Math.round((completedCount / pageCriteria.length) * 100);
}

function Autoevamanager() {
  const [listData, setListData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState("global");
  const [associateSections, setAssociateSections] = useState([]);
  const [associateMissions, setAssociateMissions] = useState([]);
  const [note, setNote] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState(1);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selectedMissionId, setSelectedMissionId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadManagers() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getAssociateManagerEvaluations();

        if (cancelled) return;
        setListData(response);
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
      setDetailData(null);
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
        const nextSections = buildSectionsPayload(response?.associate_review?.sections || []);
        const nextMissions = buildMissionsPayload(response?.associate_review?.missions || []);
        const firstSection = nextSections[0];
        const firstPage = getSectionPages(firstSection)[0];

        setDetailData(response);
        setAssociateSections(nextSections);
        setAssociateMissions(nextMissions);
        setNote(response?.associate_review?.note || "");
        setSelectedSectionId(firstSection?.id || firstSection?.section_id || 1);
        setSelectedPageId(firstPage?.id || "");
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

  const items = listData?.items || [];
  const selectedManager = items.find((item) => item.id === selectedManagerId) || null;
  const selfSections = detailData?.self_evaluation?.sections || [];
  const selfMissions = detailData?.self_evaluation?.missions || [];
  const currentSectionIndex = Math.max(
    0,
    associateSections.findIndex((section) => Number(section.id || section.section_id) === Number(selectedSectionId))
  );
  const currentSection = associateSections[currentSectionIndex] || null;
  const currentSelfSection = selfSections[currentSectionIndex] || null;
  const sectionPages = useMemo(() => getSectionPages(currentSection), [currentSection]);

  useEffect(() => {
    if (!sectionPages.length) {
      setSelectedPageId("");
      return;
    }

    if (!sectionPages.some((page) => String(page.id) === String(selectedPageId))) {
      setSelectedPageId(sectionPages[0].id);
    }
  }, [sectionPages, selectedPageId]);

  const selectedPage = sectionPages.find((page) => String(page.id) === String(selectedPageId)) || sectionPages[0] || null;
  const visibleCriteria = (currentSection?.criteria || []).filter((criterion) =>
    selectedPage ? String(criterion.page_id || criterion.pageId || "") === String(selectedPage.id) : true
  );
  const visibleSelfCriteria = (currentSelfSection?.criteria || []).filter((criterion) =>
    selectedPage ? String(criterion.page_id || criterion.pageId || "") === String(selectedPage.id) : true
  );

  const currentMissionIndex = Math.max(0, associateMissions.findIndex((mission) => mission.id === selectedMissionId));
  const currentMission = associateMissions[currentMissionIndex] || null;
  const currentSelfMission = selfMissions[currentMissionIndex] || null;
  const associateGlobalAverage = useMemo(() => getOverallAverage(associateSections), [associateSections]);
  const associateMissionAverage = useMemo(() => getMissionsAverage(associateMissions), [associateMissions]);

  const kpis = useMemo(() => {
    const total = items.length;
    const withSelfEval = items.filter((item) => item.selfEvaluationAvailable).length;
    const withMissions = items.filter((item) => item.missionsCount > 0).length;

    return [
      { title: "Managers / senior managers", value: `${total}`, subtitle: "Tous les profils actifs de la base" },
      { title: "Auto-évaluations disponibles", value: `${withSelfEval}/${total || 0}`, subtitle: "Managers ayant déjà soumis leurs évaluations globales" },
      { title: "Missions à évaluer", value: `${withMissions}/${total || 0}`, subtitle: "Managers avec missions transmises" },
    ];
  }, [items]);

  const setCriterionScore = (criterionId, score) => {
    setAssociateSections((currentSections) =>
      currentSections.map((section) => ({
        ...section,
        pages: (section.pages || []).map((page) => ({
          ...page,
          themes: (page.themes || []).map((theme) =>
            theme.theme_id === criterionId ? { ...theme, score } : theme
          ),
        })),
        criteria: (section.criteria || []).map((criterion) =>
          criterion.criterion_id === criterionId ? { ...criterion, score } : criterion
        ),
      }))
    );
    setStatus("");
  };

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

  const saveEvaluation = async () => {
    if (!selectedManagerId) return;

    try {
      const response = await saveAssociateManagerEvaluation(selectedManagerId, {
        sections: associateSections,
        missions: associateMissions,
        note,
      });

      const nextSections = buildSectionsPayload(response?.associate_review?.sections || []);
      const nextMissions = buildMissionsPayload(response?.associate_review?.missions || []);

      setDetailData(response);
      setAssociateSections(nextSections);
      setAssociateMissions(nextMissions);
      setNote(response?.associate_review?.note || "");
      setStatus("Évaluation associé enregistrée.");
      setListData((current) => ({
        ...current,
        items: (current?.items || []).map((item) =>
          item.id === selectedManagerId
            ? {
                ...item,
                associateGlobalScore: getOverallAverage(nextSections),
                associateMissionScore: getMissionsAverage(nextMissions),
              }
            : item
        ),
      }));
    } catch (error) {
      setStatus(error.message || "Enregistrement impossible.");
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
        <h1 className="text-xl font-black tracking-tight text-[#0F3A63]">Auto-évaluations des managers</h1>
        <p className="text-xs font-semibold text-slate-500">
          L'associé évalue ici tous les managers et senior managers, globalement sur la matrice manager et par mission quand une mission a été transmise.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {kpis.map((item) => (
          <article key={item.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-xs font-semibold">{item.title}</p>
            <p className="mt-3 text-xl font-extrabold leading-none">{item.value}</p>
            <p className="mt-3 text-xs font-semibold text-slate-100">{item.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
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

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-bold text-[#0F4A72]">Global</p>
                    <p className={`mt-2 text-lg font-black ${scoreTone(selectedManager.associateGlobalScore)}`}>
                      {formatScore(selectedManager.associateGlobalScore)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-bold text-[#0F4A72]">Missions</p>
                    <p className={`mt-2 text-lg font-black ${scoreTone(selectedManager.associateMissionScore)}`}>
                      {formatScore(selectedManager.associateMissionScore)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs font-semibold">
                  <p className={selectedManager.selfEvaluationAvailable ? "text-[#78B843]" : "text-slate-500"}>
                    {selectedManager.selfEvaluationAvailable ? "Auto-évaluation globale déjà disponible" : "Pas encore d'auto-évaluation globale soumise"}
                  </p>
                  <p className={selectedManager.missionsCount ? "text-[#78B843]" : "text-slate-500"}>
                    {selectedManager.missionsCount ? `${selectedManager.missionsCount} mission(s) à évaluer` : "Aucune mission soumise à l'associé pour l'instant"}
                  </p>
                </div>
              </div>
            ) : null}
          </aside>

          <div className="rounded-xl bg-[#D4DADF] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-6 text-sm font-semibold text-[#0F3A63]">
                <button
                  onClick={() => setActiveTab("global")}
                  className={`${activeTab === "global" ? "border-b-2 border-[#F34B4B]" : ""} pb-1 font-bold`}
                >
                  Évaluation globale
                </button>
                <button
                  onClick={() => setActiveTab("missions")}
                  className={`${activeTab === "missions" ? "border-b-2 border-[#F34B4B]" : ""} pb-1 font-bold`}
                >
                  Évaluation par mission
                </button>
              </div>

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
            ) : activeTab === "global" ? (
              <section className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-[#F7FAFC] p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">Auto-évaluation manager</p>
                    <p className={`mt-3 text-xl font-black ${scoreTone(detailData?.self_evaluation?.summary?.overallAverage)}`}>
                      {formatScore(detailData?.self_evaluation?.summary?.overallAverage)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F7FAFC] p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">Score associé</p>
                    <p className={`mt-3 text-xl font-black ${scoreTone(associateGlobalAverage)}`}>
                      {formatScore(associateGlobalAverage)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F7FAFC] p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">Sections</p>
                    <p className="mt-3 text-xl font-black text-[#0F3A63]">{associateSections.length}</p>
                  </div>
                </div>

                {currentSection ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-400">Pagination section</p>
                        <h3 className="text-lg font-black text-[#0F3A63]">{currentSection.title}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Moyenne associé : {formatScore(getSectionAverage(currentSection))}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 rounded-full bg-[#F4F7FB] px-3 py-2 text-sm font-bold text-[#0F4A72]">
                        <button
                          onClick={() => setSelectedSectionId(associateSections[Math.max(currentSectionIndex - 1, 0)]?.id || selectedSectionId)}
                          disabled={currentSectionIndex === 0}
                          className="rounded-full p-1 disabled:opacity-30"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span>
                          Section {currentSectionIndex + 1} / {associateSections.length}
                        </span>
                        <button
                          onClick={() =>
                            setSelectedSectionId(
                              associateSections[Math.min(currentSectionIndex + 1, associateSections.length - 1)]?.id || selectedSectionId
                            )
                          }
                          disabled={currentSectionIndex >= associateSections.length - 1}
                          className="rounded-full p-1 disabled:opacity-30"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {sectionPages.length ? (
                      <div className="rounded-xl bg-[#F7FAFC] p-3">
                        <p className="mb-2 text-xs font-extrabold text-[#0F4A72]">Pagination des titres</p>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                          {sectionPages.map((page, index) => (
                            <button
                              key={page.id}
                              onClick={() => setSelectedPageId(page.id)}
                              className={`rounded-lg border p-3 text-left ${
                                String(selectedPageId) === String(page.id)
                                  ? "border-[#8BC43F] bg-[#F1F8E8]"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <p className="text-[11px] font-bold leading-none text-[#0F3A63]">Titre {index + 1}</p>
                              <p className="mt-2 text-sm font-extrabold leading-snug text-[#0F3A63]">{page.title}</p>
                              <p className="mt-2 text-[11px] font-semibold leading-none text-[#78B843]">
                                {getPageProgress(currentSection, page.id)}%
                              </p>
                              <p className="mt-1 text-[11px] font-semibold leading-none text-[#78B843]">
                                {selectedPage && String(selectedPage.id) === String(page.id) ? "Actif" : "Choisir"}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {visibleCriteria.length ? (
                        visibleCriteria.map((criterion, index) => {
                          const managerCriterion = visibleSelfCriteria[index];

                          return (
                            <div key={criterion.criterion_id || index} className="rounded-lg bg-[#F8FAFC] p-4">
                              <div className="mb-3">
                                <p className="text-base font-black leading-snug text-[#0F3A63]">{criterion.label}</p>
                              </div>

                              <p className="text-sm leading-8 text-slate-500">{criterion.statement}</p>

                              <p className="mt-3 text-xs font-black text-[#78B843]">
                                Manager : {managerCriterion?.score ?? "--"}/5
                              </p>

                              <div className="mt-4 flex overflow-hidden rounded-md border border-slate-200">
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={`${criterion.criterion_id}-${value}`}
                                    onClick={() => setCriterionScore(criterion.criterion_id, value)}
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
                        })
                      ) : (
                        <p className="rounded-lg bg-[#F8FAFC] p-4 text-sm font-semibold text-slate-500">
                          Aucun critère n'est disponible pour ce titre.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl bg-[#F7FAFC] p-4">
                      <p className="text-sm font-extrabold text-[#0F4A72]">Commentaire global associé</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Utilisez ce bloc pour votre lecture générale du manager sur sa matrice globale.
                      </p>
                      <textarea
                        value={note}
                        onChange={(event) => {
                          setNote(event.target.value);
                          setStatus("");
                        }}
                        placeholder="Votre lecture globale du manager..."
                        className="mt-3 min-h-[150px] w-full resize-none rounded-lg bg-[#ECEFF3] px-3 py-4 text-sm text-slate-700 outline-none placeholder:text-slate-500"
                      />
                      <button onClick={saveEvaluation} className="mt-4 rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">
                        Enregistrer
                      </button>
                      {status ? <p className="mt-2 text-xs font-semibold text-[#0F4A72]">{status}</p> : null}
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">
                    Aucune section disponible pour ce manager.
                  </p>
                )}
              </section>
            ) : (
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                <aside className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-[#0F4A72]">Missions à évaluer</p>
                    <span className="rounded-full bg-[#F4F7FB] px-3 py-1 text-xs font-bold text-[#0F4A72]">
                      {associateMissions.length} mission(s)
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {associateMissions.length ? (
                      associateMissions.map((mission, index) => (
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
                        </button>
                      ))
                    ) : (
                      <p className="text-sm font-semibold text-slate-500">
                        Aucune mission transmise à l'associé pour ce manager.
                      </p>
                    )}
                  </div>
                </aside>

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

                      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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
                      </div>

                      <div className="space-y-3">
                        {(currentMission.criteria || []).map((criterion, index) => {
                          const managerCriterion = (currentSelfMission?.criteria || [])[index];

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
                        <p className="mb-2 text-sm font-bold text-[#0F4A72]">Commentaire mission associé</p>
                        <textarea
                          value={currentMission.comment || ""}
                          onChange={(event) => {
                            const nextComment = event.target.value;
                            setAssociateMissions((currentMissions) =>
                              currentMissions.map((mission) =>
                                mission.id === currentMission.id ? { ...mission, comment: nextComment } : mission
                              )
                            );
                            setStatus("");
                          }}
                          className="min-h-[120px] w-full resize-none rounded-lg bg-[#ECEFF3] px-3 py-3 text-sm text-slate-700 outline-none"
                        />
                        <button onClick={saveEvaluation} className="mt-4 rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">
                          Enregistrer
                        </button>
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
    </div>
  );
}

export default Autoevamanager;
