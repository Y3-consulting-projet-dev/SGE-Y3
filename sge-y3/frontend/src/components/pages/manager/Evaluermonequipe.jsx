import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getManagerMemberEvaluation,
  saveManagerMemberEvaluation,
  submitManagerMemberEvaluation,
} from "@/lib/managerOverview";

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
  if (!value) return "Date non renseignee";
  return new Date(value).toLocaleDateString("fr-FR");
}

function Evaluermonequipe({ member }) {
  const [reviewData, setReviewData] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeView, setActiveView] = useState("mission");
  const [activeSectionId, setActiveSectionId] = useState(1);
  const [pageIndexes, setPageIndexes] = useState({});
  const [activeMissionId, setActiveMissionId] = useState("");
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
        setActiveSectionId(Number(response.review.activeSectionId || response.review.sections?.[0]?.id || 1));
        setActiveMissionId((current) => current || response.submitted_missions?.[0]?.id || "");
        setPageIndexes(createInitialPageIndexes(response.review.sections || []));
        setSavedComments(
          Object.fromEntries(
            (response.review.sections || [])
              .flatMap((section) => section.pages || [])
              .filter((page) => page.comment?.trim())
              .map((page) => [page.page_id, page.comment.trim()])
          )
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de l'evaluation manager impossible.");
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
  const activeMission = submittedMissions.find((mission) => mission.id === activeMissionId) || submittedMissions[0] || null;
  const hasLowScoreOnActivePage = (activePage?.themes || []).some(
    (theme) => typeof theme.score === "number" && theme.score < 3
  );
  const hasRequiredJustification = !hasLowScoreOnActivePage || Boolean((activePage?.comment || "").trim());

  function syncSections(updater) {
    setSections((currentSections) => {
      const nextSections = typeof updater === "function" ? updater(currentSections) : updater;

      return nextSections.map((section) => {
        const progress = getSectionProgress(section);
        return {
          ...section,
          status: progress === 0 ? "A faire" : progress === 100 ? "Complete" : "En cours",
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
          pages: (section.pages || []).map((page, pageIndex) =>
            pageIndex !== activePageIndex ? page : { ...page, comment }
          ),
        };
      })
    );
  }

  async function persistSections(nextSections = sections, successMessage = "Evaluation manager enregistree.") {
    if (!member?.id) return null;

    try {
      setIsSaving(true);
      setFeedbackMessage("");
      const response = await saveManagerMemberEvaluation(member.id, {
        sections: nextSections,
      });

      setReviewData(response);
      setSections(response.review.sections || []);
      setPageIndexes((current) => clampPageIndexes(response.review.sections || [], current));
      setSavedComments(
        Object.fromEntries(
          (response.review.sections || [])
            .flatMap((section) => section.pages || [])
            .filter((page) => page.comment?.trim())
            .map((page) => [page.page_id, page.comment.trim()])
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
      setFeedbackMessage("Une justification est requise pour toute note inferieure a 3.");
      return;
    }

    await persistSections(sections, "Evaluation manager enregistree.");
    goToStep(1);
  }

  async function handleSubmit() {
    if (!hasRequiredJustification) {
      setFeedbackTone("error");
      setFeedbackMessage("Une justification est requise pour toute note inferieure a 3.");
      return;
    }

    const savedReview = await persistSections(sections, "Evaluation manager prete pour soumission.");

    if (!savedReview) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await submitManagerMemberEvaluation(member.id);
      setReviewData(response);
      setSections(response.review.sections || []);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Evaluation soumise a la RH / Capital Humain.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'evaluation manager...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!reviewData || !sections.length || !activeSection || !activePage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucune evaluation disponible pour ce membre.</section>;
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
            Departement du membre : {reviewData.member.department} | Matrice utilisee : {evaluationDepartment}
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
          <h2 className="text-lg font-black text-[#0F3A63]">Evaluations par mission</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {submittedMissions.length} mission(s) soumise(s)
          </p>
          <p className="mt-2 text-xs font-semibold text-[#0B4C7A]">
            Consultez les scores finaux deja transmis pour chaque mission.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("global")}
          className={`rounded-xl border px-5 py-4 text-left shadow-sm transition ${
            activeView === "global"
              ? "border-[#B7D39E] bg-[#FBFEF7]"
              : "border-[#D9E3EE] bg-white hover:bg-[#FCFEF8]"
          }`}
        >
          <div className="mb-3 inline-flex rounded-full bg-[#DCECCB] px-3 py-1 text-[11px] font-bold uppercase text-[#4E8B1B]">
            Parcours 2
          </div>
          <h2 className="text-lg font-black text-[#0F3A63]">Evaluation globale du cycle</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {reviewData.review.cycle_label || "Cycle 2025-2026"} - {globalProgress}%
          </p>
          <p className="mt-2 text-xs font-semibold text-[#4E8B1B]">
            Notez la matrice globale du membre puis soumettez a la RH.
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
                        onClick={() => setActiveMissionId(mission.id)}
                        className={`w-full rounded-md border p-3 text-left transition ${
                          activeMission?.id === mission.id ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{mission.period || "Periode non renseignee"}</p>
                        <p className="mt-1 text-xs font-bold text-[#0F3A63]">{mission.department}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Aucune mission soumise a ce manager pour le moment.</p>
                )}
              </div>
            </article>

            <article className="space-y-4">
              {activeMission ? (
                <section className="rounded-md border border-[#BFD7EA] bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="mb-2 inline-flex rounded-full bg-[#E7F1F8] px-3 py-1 text-[11px] font-bold uppercase text-[#0B4C7A]">
                        Evaluation par mission
                      </div>
                      <h4 className="text-xl font-black text-[#0F3A63]">{activeMission.title}</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {activeMission.period || "Periode non renseignee"} - {activeMission.department}
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
                        {submission.comment ? <p className="mt-3 text-sm text-slate-600">{submission.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-md border border-[#BFD7EA] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Aucune mission selectionnee.</p>
                </section>
              )}
            </article>
          </>
        ) : (
          <>
            <article className="space-y-4">
              <div className="rounded-md border border-[#D9E3EE] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[#76B82A]">Evaluation globale recue</p>
                  <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                    {selfEvaluation.overallAverage ?? "--"} / 5
                  </span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-evaluation du membre</p>
                <div className="mt-3 space-y-2">
                  {(selfEvaluation.sectionScores || []).map((section) => (
                    <div key={section.sectionId} className="flex items-center justify-between text-sm font-semibold text-[#0F3A63]">
                      <span>{section.title}</span>
                      <span className="text-[#76B82A]">{section.score ?? "--"} / 5</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-500">
                  Statut : {selfEvaluation.status || "En attente"} | Moyenne : {selfEvaluation.overallAverage ?? "--"} / 5
                </p>
              </div>

              <div className="rounded-md border border-[#D9E3EE] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[#76B82A]">Scores globaux recus</p>
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Aucun score global encore soumis a votre niveau.</p>
                )}
              </div>

              <div className="rounded-md border border-[#DCE7D0] bg-[#FCFEF8] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#4E8B1B]">Sections globales</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {completedSections} / {sections.length} complete(s)
                    </p>
                  </div>
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">{globalProgress}%</span>
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
                          <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-1 text-xs font-bold text-[#76B82A]">{progress}% complete</p>
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
                      {recipient.name} ({recipient.department})
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
                  Evaluation globale du cycle
                </div>
                <h4 className="text-2xl font-black text-[#0F3A63]">{activeSection.title}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">Score moyen du titre : {activePageAverage} / 5</p>
              </div>
              <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs font-bold text-[#0F3A63]">
                {reviewData.review.last_saved_at ? "Enregistree" : "Non disponible"}
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
                      <p className="mt-1 text-[10px] font-semibold text-[#76B82A]">{progress}%</p>
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
                Une note inferieure a 3 a ete detectee. Merci de justifier cet ecart.
              </div>
            ) : null}

            <div className="mt-4">
              <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">
                {hasLowScoreOnActivePage ? "Justification de l'ecart" : "Commentaire du titre"}
              </p>
              <textarea
                rows={4}
                value={activePage.comment || ""}
                onChange={(event) => updateComment(event.target.value)}
                placeholder={
                  hasLowScoreOnActivePage
                    ? "Expliquez la raison de la note inferieure a 3..."
                    : "Faits marquants, ecarts constates, recommandations..."
                }
                className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
              />
            </div>

            {savedComments[activePage.page_id] ? (
              <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2">
                <p className="text-[10px] font-bold text-[#5A8A3A]">Commentaire sauvegarde</p>
                <p className="mt-1 text-[11px] font-semibold text-[#0F3A63]">{savedComments[activePage.page_id]}</p>
              </div>
            ) : null}

            <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
              Toutes les questions doivent etre renseignees avant soumission a la RH / Capital Humain.
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToStep(-1)}
                disabled={Number(activeSectionId) === Number(sections[0]?.id) && activePageIndex === 0}
                className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={14} />
                Precedent
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
                      disabled={isSaving || isSubmitting || reviewData.review.status === "Soumis a RH"}
                      className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                    >
                      {isSubmitting ? "Soumission..." : "Soumettre a la RH"}
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
