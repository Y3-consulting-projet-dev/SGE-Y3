import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAssociateSupportEvaluation,
  getAssociateSupportEvaluations,
  saveAssociateSupportEvaluation,
  submitAssociateSupportEvaluation,
} from "@/api/associateOverview";

function formatScore(score) {
  return typeof score === "number" ? `${score.toFixed(1)}/5` : "--";
}

function scoreTone(score) {
  if (typeof score !== "number") return "text-[#0F3A63]";
  if (score >= 4) return "text-[#78B843]";
  if (score < 3) return "text-[#C53B3B]";
  return "text-[#0F3A63]";
}

function getAverage(scores = []) {
  const numericScores = scores.filter((score) => typeof score === "number");
  if (!numericScores.length) return null;
  return numericScores.reduce((total, score) => total + score, 0) / numericScores.length;
}

function getSectionAverage(section) {
  return getAverage((section?.criteria || []).map((criterion) => criterion.score));
}

function getOverallAverage(sections = []) {
  return getAverage(sections.flatMap((section) => (section.criteria || []).map((criterion) => criterion.score)));
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

function getSectionPages(section) {
  const explicitPages = (section?.pages || []).map((page) => ({
    id: page.page_id,
    title: page.title,
    sourceLabel: page.source_label || page.source_sheet || "",
  }));

  if (explicitPages.length) return explicitPages;

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

function AutoevaluationSupport() {
  const [listData, setListData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedSupportId, setSelectedSupportId] = useState("");
  const [associateSections, setAssociateSections] = useState([]);
  const [note, setNote] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState(1);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSupportMembers() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        setSuccessMessage("");
        const response = await getAssociateSupportEvaluations();

        if (cancelled) return;
        setListData(response);
        setSelectedSupportId(response?.items?.[0]?.id || "");
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message || "Chargement du service support impossible.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadSupportMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSupportId) {
      setDetailData(null);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        setIsDetailLoading(true);
        setErrorMessage("");
        setSuccessMessage("");
        const response = await getAssociateSupportEvaluation(selectedSupportId);
        const nextSections = buildSectionsPayload(response?.associate_review?.sections || []);
        const firstSection = nextSections[0];
        const firstPage = getSectionPages(firstSection)[0];

        if (cancelled) return;
        setDetailData(response);
        setAssociateSections(nextSections);
        setNote(response?.associate_review?.note || "");
        setSelectedSectionId(firstSection?.id || firstSection?.section_id || 1);
        setSelectedPageId(firstPage?.id || "");
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message || "Chargement du détail support impossible.");
      } finally {
        if (!cancelled) setIsDetailLoading(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSupportId]);

  const items = listData?.items || [];
  const selectedSupport = items.find((item) => item.id === selectedSupportId) || null;
  const selfSections = detailData?.self_evaluation?.sections || [];
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
  const associateAverage = useMemo(() => getOverallAverage(associateSections), [associateSections]);

  const flatSteps = useMemo(() => {
    return associateSections.flatMap((section) => {
      const sectionId = section.id || section.section_id;
      const pages = getSectionPages(section);
      if (!pages.length) return [{ sectionId, pageId: "" }];
      return pages.map((page) => ({ sectionId, pageId: page.id }));
    });
  }, [associateSections]);

  const currentStepIndex = useMemo(
    () =>
      flatSteps.findIndex(
        (step) => String(step.sectionId) === String(selectedSectionId) && String(step.pageId) === String(selectedPageId)
      ),
    [flatSteps, selectedSectionId, selectedPageId]
  );

  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex === -1 || currentStepIndex >= flatSteps.length - 1;

  const goToStep = (offset) => {
    if (!flatSteps.length) return;
    const baseIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
    const nextIndex = Math.min(Math.max(baseIndex + offset, 0), flatSteps.length - 1);
    const nextStep = flatSteps[nextIndex];
    if (!nextStep) return;
    setSelectedSectionId(nextStep.sectionId);
    setSelectedPageId(nextStep.pageId);
  };

  const kpis = useMemo(() => {
    const total = items.length;
    const submitted = items.filter((item) => item.selfEvaluationAvailable).length;
    const evaluated = items.filter((item) => typeof item.associateScore === "number").length;

    return [
      { title: "Membres support", value: `${total}`, subtitle: "Office manager, PMO, IT et comptabilité interne" },
      { title: "Auto-évaluations reçues", value: `${submitted}/${total || 0}`, subtitle: "Soumises aux associés" },
      { title: "Évaluations associées", value: `${evaluated}/${total || 0}`, subtitle: "Notes déjà enregistrées" },
    ];
  }, [items]);

  const setCriterionScore = (criterionId, score) => {
    setAssociateSections((currentSections) =>
      currentSections.map((section) => ({
        ...section,
        pages: (section.pages || []).map((page) => ({
          ...page,
          themes: (page.themes || []).map((theme) => (theme.theme_id === criterionId ? { ...theme, score } : theme)),
        })),
        criteria: (section.criteria || []).map((criterion) =>
          criterion.criterion_id === criterionId ? { ...criterion, score } : criterion
        ),
      }))
    );
  };

  const saveEvaluation = async () => {
    if (!selectedSupportId) return false;

    try {
      setErrorMessage("");
      const response = await saveAssociateSupportEvaluation(selectedSupportId, {
        sections: associateSections,
        note,
      });
      const nextSections = buildSectionsPayload(response?.associate_review?.sections || []);

      setDetailData(response);
      setAssociateSections(nextSections);
      setNote(response?.associate_review?.note || "");
      setListData((current) => ({
        ...current,
        items: (current?.items || []).map((item) =>
          item.id === selectedSupportId
            ? {
                ...item,
                associateScore: getOverallAverage(nextSections),
                annotationSaved: true,
              }
            : item
        ),
      }));
      setSuccessMessage(response?.message || "Évaluation support enregistrée.");
      return true;
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage(error.message || "Enregistrement impossible.");
      return false;
    }
  };

  const handleSaveAndContinue = async () => {
    const saved = await saveEvaluation();
    if (saved) {
      goToStep(1);
    }
  };

  const submitEvaluation = async () => {
    if (!selectedSupportId) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");
      const response = await submitAssociateSupportEvaluation(selectedSupportId, {
        sections: associateSections,
        note,
      });
      const nextSections = buildSectionsPayload(response?.associate_review?.sections || []);

      setDetailData(response);
      setAssociateSections(nextSections);
      setNote(response?.associate_review?.note || "");
      setListData((current) => ({
        ...current,
        items: (current?.items || []).map((item) =>
          item.id === selectedSupportId
            ? {
                ...item,
                associateScore: getOverallAverage(nextSections),
                annotationSaved: true,
              }
            : item
        ),
      }));
      setSuccessMessage(response?.message || "Évaluation transmise à la RH.");
    } catch (error) {
      setErrorMessage(error.message || "Transmission à la RH impossible.");
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement du service support...
      </section>
    );
  }

  if (errorMessage && !items.length && !detailData) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-black tracking-tight text-[#0F3A63]">Auto-évaluations du service support</h1>
        <p className="text-xs font-semibold text-slate-500">
          Les associés évaluent ici les membres du service support à partir de leur auto-évaluation transmise.
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
              <h2 className="text-base font-extrabold text-[#0F3A63]">Sélection du membre support</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">{items.length} profil(s)</span>
            </div>

            <label className="mt-4 block text-sm font-bold text-[#0F3A63]">
              Filtrer / sélectionner
              <select
                value={selectedSupportId}
                onChange={(event) => setSelectedSupportId(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-[#0F3A63] outline-none"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.role}
                  </option>
                ))}
              </select>
            </label>

            {selectedSupport ? (
              <div className="mt-4 rounded-xl border border-[#8BC43F] bg-[#F1F8E8] p-4">
                <p className="text-base font-extrabold text-[#0F3A63]">{selectedSupport.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{selectedSupport.role}</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-bold text-[#0F4A72]">Auto-évaluation</p>
                    <p className={`mt-2 text-lg font-black ${scoreTone(selectedSupport.selfScore)}`}>
                      {formatScore(selectedSupport.selfScore)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-bold text-[#0F4A72]">Associé</p>
                    <p className={`mt-2 text-lg font-black ${scoreTone(selectedSupport.associateScore)}`}>
                      {formatScore(selectedSupport.associateScore)}
                    </p>
                  </div>
                </div>

                <p className={`mt-4 text-xs font-semibold ${selectedSupport.selfEvaluationAvailable ? "text-[#78B843]" : "text-slate-500"}`}>
                  {selectedSupport.selfEvaluationAvailable
                    ? "Auto-évaluation support disponible"
                    : "Pas encore d'auto-évaluation support soumise"}
                </p>
              </div>
            ) : null}
          </aside>

          <article className="rounded-xl bg-[#D4DADF] p-3">
            {errorMessage && items.length ? (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{errorMessage}</div>
            ) : null}

            {successMessage && items.length ? (
              <div className="mb-3 rounded-lg bg-[#F1F8E8] px-3 py-2 text-sm font-semibold text-[#4C8A1F]">{successMessage}</div>
            ) : null}

            {isDetailLoading ? (
              <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500">Chargement du détail support...</section>
            ) : (
              <section className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-[#F7FAFC] p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">Auto-évaluation support</p>
                    <p className={`mt-3 text-xl font-black ${scoreTone(detailData?.self_evaluation?.summary?.overallAverage)}`}>
                      {formatScore(detailData?.self_evaluation?.summary?.overallAverage)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F7FAFC] p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">Score associé</p>
                    <p className={`mt-3 text-xl font-black ${scoreTone(associateAverage)}`}>{formatScore(associateAverage)}</p>
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

                    <div className="rounded-xl bg-[#F7FAFC] p-3">
                      <p className="mb-2 text-xs font-extrabold text-[#0F4A72]">Pagination des titres</p>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                        {sectionPages.map((page, index) => (
                          <button
                            key={page.id}
                            onClick={() => setSelectedPageId(page.id)}
                            className={`rounded-lg border p-3 text-left ${
                              String(selectedPageId) === String(page.id) ? "border-[#8BC43F] bg-[#F1F8E8]" : "border-slate-200 bg-white"
                            }`}
                          >
                            <p className="text-[11px] font-bold leading-none text-[#0F3A63]">Titre {index + 1}</p>
                            <p className="mt-2 text-sm font-extrabold leading-snug text-[#0F3A63]">{page.title}</p>
                            <p className="mt-2 text-[11px] font-semibold leading-none text-[#78B843]">
                              {getPageProgress(currentSection, page.id)}%
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {visibleCriteria.length ? (
                        visibleCriteria.map((criterion, index) => {
                          const supportCriterion = visibleSelfCriteria[index];

                          return (
                            <div key={criterion.criterion_id || index} className="rounded-lg bg-[#F8FAFC] p-4">
                              <p className="text-base font-black leading-snug text-[#0F3A63]">{criterion.label}</p>
                              <p className="mt-2 text-sm leading-8 text-slate-500">{criterion.statement}</p>
                              <p className="mt-3 text-xs font-black text-[#78B843]">
                                Support : {supportCriterion?.score ?? "--"}/5
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
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Votre lecture globale du service support..."
                        className="mt-3 min-h-[150px] w-full resize-none rounded-lg bg-[#ECEFF3] px-3 py-4 text-sm text-slate-700 outline-none placeholder:text-slate-500"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => goToStep(-1)}
                        disabled={isFirstStep}
                        className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft size={14} />
                        Précédent
                      </button>

                      {isLastStep ? (
                        <button
                          type="button"
                          onClick={submitEvaluation}
                          className="inline-flex items-center gap-2 rounded-md bg-[#0C4B6C] px-4 py-2 text-sm font-bold text-white"
                        >
                          Soumettre l'évaluation
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSaveAndContinue}
                          className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-sm font-bold text-white"
                        >
                          Sauvegarder et continuer
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Aucune section disponible pour ce membre support.</p>
                )}
              </section>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

export default AutoevaluationSupport;
