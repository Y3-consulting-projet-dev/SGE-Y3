import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAssociateSelfEvaluation,
  getReceivedAssociateEvaluation,
  getReceivedAssociateEvaluations,
  saveAssociateSelfEvaluation,
  saveReceivedAssociateEvaluationComment,
  submitAssociateSelfEvaluation,
} from "@/lib/associateOverview";
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
    </div>
  );
}

function SectionBadge({ progress }) {
  if (progress === 100) {
    return <span className="rounded-full bg-[#DFECD4] px-3 py-1 text-[11px] font-semibold text-[#79B742]">ComplÃ¨te</span>;
  }

  if (progress > 0) {
    return <span className="rounded-full bg-[#F6D4D4] px-3 py-1 text-xs font-semibold text-[#DF4C4C]">En cours</span>;
  }

  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Ã€ faire</span>;
}

function formatAssociateStatus(status = "") {
  return String(status || "")
    .replaceAll("Associes", "Associés")
    .replaceAll("Associe", "Associé");
}

function AutoevaluationAssocie() {
  const [activeTab, setActiveTab] = useState("self");
  const [selfData, setSelfData] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(1);
  const [pageIndexes, setPageIndexes] = useState({});
  const [receivedList, setReceivedList] = useState([]);
  const [selectedReceivedId, setSelectedReceivedId] = useState("");
  const [receivedDetail, setReceivedDetail] = useState(null);
  const [receivedComment, setReceivedComment] = useState("");
  const [peerSections, setPeerSections] = useState([]);
  const [peerActiveSectionId, setPeerActiveSectionId] = useState(1);
  const [peerPageIndexes, setPeerPageIndexes] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const [selfResponse, receivedResponse] = await Promise.all([
          getAssociateSelfEvaluation(),
          getReceivedAssociateEvaluations(),
        ]);

        if (cancelled) return;

        setSelfData(selfResponse);
        setSections(selfResponse.evaluation.sections || []);
        setActiveSectionId(Number(selfResponse.evaluation.activeSectionId || selfResponse.evaluation.sections?.[0]?.id || 1));
        setPageIndexes(createInitialPageIndexes(selfResponse.evaluation.sections || []));
        setReceivedList(receivedResponse.items || []);
        setSelectedReceivedId((receivedResponse.items || [])[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des auto-évaluations associé impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedReceivedId) {
      setReceivedDetail(null);
      setReceivedComment("");
      return;
    }

    let cancelled = false;

    async function loadReceivedDetail() {
      try {
        const response = await getReceivedAssociateEvaluation(selectedReceivedId);
        if (cancelled) return;
        const reviewSections = response.peerReview?.sections || [];
        setReceivedDetail(response);
        setReceivedComment(response.peerReview?.comment || "");
        setPeerSections(reviewSections);
        setPeerActiveSectionId(Number(response.peerReview?.activeSectionId || reviewSections[0]?.id || 1));
        setPeerPageIndexes(createInitialPageIndexes(reviewSections));
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement du dÃ©tail associé impossible.");
        }
      }
    }

    loadReceivedDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedReceivedId]);

  const activeSection = sections.find((section) => Number(section.id) === Number(activeSectionId)) || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const progress = Math.round(
    sections.reduce((total, section) => total + getSectionProgress(section), 0) / (sections.length || 1)
  );
  const averageScore = useMemo(() => getPageAverage(activePage), [activePage]);
  const completedSections = sections.filter((section) => getSectionProgress(section) === 100).length;
  const peerActiveSection = peerSections.find((section) => Number(section.id) === Number(peerActiveSectionId)) || peerSections[0];
  const peerActivePageIndex = peerPageIndexes[peerActiveSection?.id] || 0;
  const peerActivePage = peerActiveSection?.pages?.[peerActivePageIndex] || peerActiveSection?.pages?.[0];
  const peerProgress = Math.round(
    peerSections.reduce((total, section) => total + getSectionProgress(section), 0) / (peerSections.length || 1)
  );
  const peerAverageScore = useMemo(() => getPageAverage(peerActivePage), [peerActivePage]);

  function syncSections(updater) {
    setSections((currentSections) =>
      (typeof updater === "function" ? updater(currentSections) : updater).map((section) => {
        const sectionProgress = getSectionProgress(section);
        return {
          ...section,
          status: sectionProgress === 0 ? "A faire" : sectionProgress === 100 ? "Complete" : "En cours",
        };
      })
    );
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
      currentSections.map((section) =>
        Number(section.id) !== Number(activeSectionId)
          ? section
          : {
              ...section,
              comment,
            }
      )
    );
  }

  function syncPeerSections(updater) {
    setPeerSections((currentSections) =>
      (typeof updater === "function" ? updater(currentSections) : updater).map((section) => {
        const sectionProgress = getSectionProgress(section);
        return {
          ...section,
          status: sectionProgress === 0 ? "A faire" : sectionProgress === 100 ? "Complete" : "En cours",
        };
      })
    );
    setFeedbackMessage("");
  }

  function updatePeerTheme(themeId, score) {
    syncPeerSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(peerActiveSectionId)) return section;
        return {
          ...section,
          pages: (section.pages || []).map((page, pageIndex) =>
            pageIndex !== peerActivePageIndex
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

  function updatePeerComment(comment) {
    syncPeerSections((currentSections) =>
      currentSections.map((section) =>
        Number(section.id) !== Number(peerActiveSectionId)
          ? section
          : {
              ...section,
              comment,
            }
      )
    );
  }

  async function persistSelf(nextSections = sections, successMessage = "Auto-évaluation associé enregistrée.") {
    try {
      setIsSaving(true);
      setErrorMessage("");
      const response = await saveAssociateSelfEvaluation({ sections: nextSections });
      setSelfData(response);
      setSections(response.evaluation.sections || []);
      setPageIndexes((current) => clampPageIndexes(response.evaluation.sections || [], current));
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

  async function handleSubmit() {
    const saved = await persistSelf(sections, "Auto-évaluation associé prête pour soumission.");
    if (!saved) return;

    try {
      setIsSubmitting(true);
      const response = await submitAssociateSelfEvaluation();
      setSelfData(response);
      setSections(response.evaluation.sections || []);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Auto-évaluation associé soumise.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveReceivedComment() {
    if (!selectedReceivedId) return;

    try {
      setIsSaving(true);
      const response = await saveReceivedAssociateEvaluationComment(selectedReceivedId, { comment: receivedComment, sections: peerSections });
      setReceivedDetail(response);
      const reviewSections = response.peerReview?.sections || [];
      setPeerSections(reviewSections);
      setPeerActiveSectionId(Number(response.peerReview?.activeSectionId || reviewSections[0]?.id || 1));
      setPeerPageIndexes((current) => clampPageIndexes(reviewSections, current));
      setReceivedList((current) =>
        current.map((item) =>
          item.id === selectedReceivedId
            ? {
                ...item,
                commentSaved: Boolean(receivedComment.trim() || reviewSections.length),
                peerReviewAverage: response.peerReview?.summary?.overallAverage,
              }
            : item
        )
      );
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Ã‰valuation associé enregistrée.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Enregistrement de l'évaluation impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  function goToStep(direction) {
    if (!activeSection) return;
    const nextPageIndex = activePageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < (activeSection.pages?.length || 0)) {
      setPageIndexes((current) => ({ ...current, [activeSection.id]: nextPageIndex }));
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

  function goToPeerStep(direction) {
    if (!peerActiveSection) return;
    const nextPageIndex = peerActivePageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < (peerActiveSection.pages?.length || 0)) {
      setPeerPageIndexes((current) => ({ ...current, [peerActiveSection.id]: nextPageIndex }));
      return;
    }

    const sectionIndex = peerSections.findIndex((section) => Number(section.id) === Number(peerActiveSectionId));
    const nextSection = peerSections[sectionIndex + direction];
    if (!nextSection) return;

    setPeerActiveSectionId(Number(nextSection.id));
    setPeerPageIndexes((current) => ({
      ...current,
      [nextSection.id]: direction > 0 ? 0 : Math.max((nextSection.pages?.length || 1) - 1, 0),
    }));
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'auto-évaluation associé...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveTab("self")}
          className={`rounded-md p-4 text-left transition ${activeTab === "self" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Associé</p>
          <h2 className="mt-1 text-lg font-black">Mon auto-évaluation</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">
            Destinataire : {selfData?.evaluation?.recipient?.name || "Aucun autre associé"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("received")}
          className={`rounded-md p-4 text-left transition ${activeTab === "received" ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] shadow-sm"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Associé</p>
          <h2 className="mt-1 text-lg font-black">Ã‰valuation reçue</h2>
          <p className="mt-2 text-xs font-semibold opacity-80">{receivedList.length} évaluation(s) à traiter</p>
        </button>
      </section>

      {feedbackMessage ? (
        <div className={`rounded-md px-4 py-3 text-sm font-semibold ${feedbackTone === "error" ? "bg-[#FDEBEC] text-[#B93840]" : "bg-[#DCECCB] text-[#184D2E]"}`}>
          {feedbackMessage}
        </div>
      ) : null}

      {activeTab === "self" ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-3 xl:col-span-5">
            <article className="rounded-md bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400">{selfData?.evaluation?.cycle_label}</p>
              <h2 className="mt-1 text-2xl font-black text-[#0F3A63]">Auto-évaluation Associé</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Soumettre à {selfData?.evaluation?.recipient?.name || "un autre associé"}
              </p>
              <div className="mt-4 h-2 rounded-full bg-slate-300">
                <div className={`h-2 rounded-full ${getProgressBarClass(progress)}`} style={{ width: `${clampProgress(progress)}%` }} />
              </div>
              <p className={`mt-2 text-xs font-semibold ${getProgressToneClass(progress)}`}>
                {completedSections} / {sections.length} sections complétées - {progress}%
              </p>
            </article>

            {(sections || []).map((section) => {
              const sectionProgress = getSectionProgress(section);
              const isActive = Number(activeSectionId) === Number(section.id);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(Number(section.id))}
                  className={`w-full rounded-md bg-white p-4 text-left shadow-sm transition ${isActive ? "ring-2 ring-[#79B742]" : "hover:bg-slate-50"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#79B742]">Section {section.id} - {section.title}</h2>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{section.pages?.length || 0} titre(s)</p>
                    </div>
                    <SectionBadge progress={sectionProgress} />
                  </div>
                </button>
              );
            })}

            {selfData?.evaluation?.peerComment ? (
              <article className="rounded-md bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#79B742]">Ã‰valuation de l'autre associé</h3>
                <p className="mt-2 text-xs font-semibold text-slate-500">{selfData.evaluation.peerComment.authorName}</p>
                <p className="mt-2 text-sm font-black text-[#0F3A63]">
                  Note : {typeof selfData.evaluation.peerComment.summary?.overallAverage === "number" ? `${selfData.evaluation.peerComment.summary.overallAverage}/5` : "--"}
                </p>
                <div className="mt-3 space-y-2">
                  {(selfData.evaluation.peerComment.sections || []).map((section) => (
                    <div key={section.id} className="rounded-md bg-[#F8FAFC] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                        <p className="text-xs font-black text-[#79B742]">{getPageAverage({ themes: (section.pages || []).flatMap((page) => page.themes || []) })}/5</p>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-600">{section.comment || "Aucun commentaire."}</p>
                    </div>
                  ))}
                </div>
                <h4 className="mt-4 text-xs font-bold uppercase text-slate-500">Appréciation</h4>
                <p className="mt-2 rounded-md bg-[#F8FAFC] p-3 text-sm font-semibold text-slate-600">
                  {selfData.evaluation.peerComment.comment}
                </p>
              </article>
            ) : null}
          </div>

          <div className="space-y-3 xl:col-span-7">
            {activeSection && activePage ? (
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
                      <p className="text-[12px] font-semibold text-slate-500">Navigation dans la section</p>
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

                      return (
                        <button
                          key={page.page_id}
                          type="button"
                          onClick={() => setPageIndexes((current) => ({ ...current, [activeSection.id]: index }))}
                          className={`rounded-md border px-3 py-2 text-left transition ${
                            isActive ? "border-[#79B742] bg-[#F3FAEA] text-[#0F3A63]" : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <p className="text-[11px] font-bold">Titre {index + 1}</p>
                          <p className="mt-1 text-[12px] font-semibold">{page.title}</p>
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
                  </div>

                  {(activePage.themes || []).map((theme) => (
                    <div key={theme.theme_id} className="rounded-md border border-[#E3EAF3] bg-[#F8FBFF] p-3">
                      <div className="mb-3">
                        <p className="text-[13px] font-bold text-[#0F3A63]">{theme.code}. {theme.label}</p>
                        <p className="mt-1 text-[12px] leading-6 text-slate-600">{theme.statement}</p>
                      </div>
                      <ScoreSelector selected={theme.score} onSelect={(score) => updateTheme(theme.theme_id, score)} />
                    </div>
                  ))}

                  <div>
                    <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire de section</p>
                    <textarea
                      rows={4}
                      value={activeSection.comment || ""}
                      onChange={(event) => updateComment(event.target.value)}
                      placeholder="SynthÃ¨se globale de la section..."
                      className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => goToStep(-1)}
                    disabled={Number(activeSectionId) === Number(sections[0]?.id) && activePageIndex === 0}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:opacity-50"
                  >
                    <ChevronLeft size={14} />
                    PrÃ©cÃ©dent
                  </button>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => persistSelf(sections)}
                      disabled={isSaving || isSubmitting}
                      className="rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 disabled:opacity-70"
                    >
                      {isSaving ? "Sauvegarde..." : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSaving || isSubmitting || selfData?.evaluation?.status === "Soumis aux Associes"}
                      className="rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      {isSubmitting ? "Soumission..." : "Soumettre à l'autre associé"}
                    </button>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      disabled={
                        Number(activeSectionId) === Number(sections[sections.length - 1]?.id) &&
                        activePageIndex === (activeSection.pages?.length || 1) - 1
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      Suivant
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
          <aside className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-extrabold text-[#0F3A63]">Ã‰valuations reçues</h2>
            <div className="mt-4 space-y-2">
              {receivedList.length ? (
                receivedList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedReceivedId(item.id);
                      setFeedbackMessage("");
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedReceivedId === item.id ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                    }`}
                  >
                    <p className="text-sm font-extrabold text-[#0F3A63]">{item.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{item.department}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#0F4A72]">{formatAssociateStatus(item.status)}</span>
                      <span className="text-xs font-black text-[#76B82A]">{typeof item.overallAverage === "number" ? `${item.overallAverage}/5` : "--"}</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="rounded-md bg-[#EEF2F6] px-3 py-3 text-sm font-semibold text-slate-500">
                  Aucune auto-évaluation reçue pour le moment.
                </p>
              )}
            </div>
          </aside>

          <article className="rounded-xl bg-white p-5 shadow-sm">
            {receivedDetail ? (
              <>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#0F3A63]">{receivedDetail.submitter.name}</h2>
                    <p className="text-sm font-semibold text-slate-500">{receivedDetail.submitter.grade} - {receivedDetail.submitter.department}</p>
                  </div>
                  <span className="rounded-full bg-[#DDECCF] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                    Score {typeof receivedDetail.summary.overallAverage === "number" ? `${receivedDetail.summary.overallAverage}/5` : "--"}
                  </span>
                </div>

                <h3 className="mb-3 text-sm font-black uppercase text-slate-500">Auto-évaluation reçue</h3>
                <div className="space-y-3">
                  {(receivedDetail.evaluation.sections || []).map((section) => (
                    <div key={section.id} className="rounded-lg bg-[#F8FAFC] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#0F3A63]">{section.title}</p>
                        <p className="text-xs font-semibold text-[#79B742]">{getPageAverage({ themes: (section.pages || []).flatMap((page) => page.themes || []) })}/5</p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">{section.comment || "Aucun commentaire de section."}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-lg border border-[#D9E3EE] bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#0F3A63]">Votre évaluation de l'associé</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Progression {peerProgress}% - score courant {peerAverageScore} / 5
                      </p>
                    </div>
                    {typeof receivedDetail.peerReview?.summary?.overallAverage === "number" ? (
                      <span className="rounded-full bg-[#DDECCF] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                        Note enregistrée {receivedDetail.peerReview.summary.overallAverage}/5
                      </span>
                    ) : null}
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {(peerSections || []).map((section) => {
                      const sectionProgress = getSectionProgress(section);
                      const isActive = Number(peerActiveSectionId) === Number(section.id);

                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setPeerActiveSectionId(Number(section.id))}
                          className={`rounded-md border p-3 text-left transition ${
                            isActive ? "border-[#79B742] bg-[#F3FAEA]" : "border-[#D9E3EE] bg-[#F8FAFC] hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-[#0F3A63]">{section.title}</p>
                            <SectionBadge progress={sectionProgress} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {peerActiveSection && peerActivePage ? (
                    <>
                      <div className="mb-4 rounded-md bg-[#F8FAFC] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-semibold text-slate-500">Navigation dans la section</p>
                            <h4 className="text-[18px] font-bold text-[#0F3A63]">{peerActiveSection.title}</h4>
                          </div>
                          <span className="text-[12px] font-semibold text-[#0F3A63]">
                            Titre {peerActivePageIndex + 1} / {peerActiveSection.pages?.length || 1}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(peerActiveSection.pages || []).map((page, index) => {
                            const isActive = index === peerActivePageIndex;
                            const pageProgress = getPageProgress(page);

                            return (
                              <button
                                key={page.page_id}
                                type="button"
                                onClick={() => setPeerPageIndexes((current) => ({ ...current, [peerActiveSection.id]: index }))}
                                className={`rounded-md border px-3 py-2 text-left transition ${
                                  isActive ? "border-[#79B742] bg-[#F3FAEA] text-[#0F3A63]" : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <p className="text-[11px] font-bold">Titre {index + 1}</p>
                                <p className="mt-1 text-[12px] font-semibold">{page.title}</p>
                                <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(pageProgress)}`}>{pageProgress}%</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-slate-500">{peerActiveSection.title}</p>
                          <p className="mt-1 text-[15px] font-bold text-[#0F3A63]">{peerActivePage.title}</p>
                        </div>

                        {(peerActivePage.themes || []).map((theme) => (
                          <div key={theme.theme_id} className="rounded-md border border-[#E3EAF3] bg-[#F8FBFF] p-3">
                            <div className="mb-3">
                              <p className="text-[13px] font-bold text-[#0F3A63]">{theme.code}. {theme.label}</p>
                              <p className="mt-1 text-[12px] leading-6 text-slate-600">{theme.statement}</p>
                            </div>
                            <ScoreSelector selected={theme.score} onSelect={(score) => updatePeerTheme(theme.theme_id, score)} />
                          </div>
                        ))}

                        <div>
                          <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire de section obligatoire</p>
                          <textarea
                            rows={4}
                            value={peerActiveSection.comment || ""}
                            onChange={(event) => updatePeerComment(event.target.value)}
                            placeholder="Commentaire global de la section..."
                            className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => goToPeerStep(-1)}
                          disabled={Number(peerActiveSectionId) === Number(peerSections[0]?.id) && peerActivePageIndex === 0}
                          className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:opacity-50"
                        >
                          <ChevronLeft size={14} />
                          PrÃ©cÃ©dent
                        </button>
                        <button
                          type="button"
                          onClick={() => goToPeerStep(1)}
                          disabled={
                            Number(peerActiveSectionId) === Number(peerSections[peerSections.length - 1]?.id) &&
                            peerActivePageIndex === (peerActiveSection.pages?.length || 1) - 1
                          }
                          className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                        >
                          Suivant
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>

                <textarea
                  value={receivedComment}
                  onChange={(event) => {
                    setReceivedComment(event.target.value);
                    setFeedbackMessage("");
                  }}
                  placeholder="Appréciation générale sur l'auto-évaluation de l'autre associé..."
                  className="mt-5 min-h-[120px] w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm text-[#0F3A63] outline-none"
                />

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveReceivedComment}
                    disabled={isSaving}
                    className="rounded-full bg-[#0F3A63] px-5 py-2 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {isSaving ? "Enregistrement..." : "Enregistrer l'évaluation"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm font-semibold text-slate-500">Aucune évaluation reçue sélectionnée.</p>
            )}
          </article>
        </section>
      )}
    </div>
  );
}

export default AutoevaluationAssocie;
