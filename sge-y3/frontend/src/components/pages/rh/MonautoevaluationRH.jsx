import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAssistantRhSelfEvaluation,
  getRhSelfEvaluation,
  saveAssistantRhSelfEvaluation,
  saveRhSelfEvaluation,
  submitAssistantRhSelfEvaluation,
  submitRhSelfEvaluation,
} from "@/lib/rhOverview";
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

function hasRequiredSubmissionComment(sections = []) {
  return sections.length > 0 && sections.every((section) => String(section.comment || "").trim().length >= 3);
}

function normalizeDepartmentLabel(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getRhRecipientRoleLabel(recipient) {
  const normalizedDepartment = normalizeDepartmentLabel(recipient?.department);
  return normalizedDepartment === "CAPITAL HUMAIN" ? "Assistante RH" : recipient?.department || recipient?.grade || "RH";
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

function getWorkflowDefaults(assistantMode) {
  if (assistantMode) {
    return {
      recipientRoleLabel: "Responsable RH",
      submitButtonLabel: "Soumettre à la RH",
      introMessage:
        "L'assistante RH s'auto-évalue sur son accompagnement du cycle, puis transmet son auto-évaluation à la RH.",
      titleLabel: "Auto-évaluation Assistante RH",
      saveMessage: "Auto-évaluation Assistante RH enregistrée.",
      readyMessage: "Auto-évaluation Assistante RH prête pour soumission.",
      submittedMessage: "Auto-évaluation Assistante RH soumise à la RH.",
    };
  }

  return {
    recipientRoleLabel: "Associé",
    submitButtonLabel: "Soumettre aux associés",
    introMessage: "La RH s'auto-évalue sur la conduite du cycle, puis transmet son auto-évaluation aux associés.",
    titleLabel: "Auto-évaluation RH",
    saveMessage: "Auto-évaluation RH enregistrée.",
    readyMessage: "Auto-évaluation RH prête pour soumission.",
    submittedMessage: "Auto-évaluation RH soumise aux associés.",
  };
}

function MonautoevaluationRH({ assistantMode = false }) {
  const [evaluationData, setEvaluationData] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(1);
  const [pageIndexes, setPageIndexes] = useState({});
  const [savedComments, setSavedComments] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const workflow = evaluationData?.workflow || getWorkflowDefaults(assistantMode);

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await (assistantMode ? getAssistantRhSelfEvaluation() : getRhSelfEvaluation());

        if (cancelled) return;

        setEvaluationData(response);
        setSections(response.evaluation.sections || []);
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
          setErrorMessage(
            error.message ||
              (assistantMode
                ? "Chargement de l'auto-évaluation Assistante RH impossible."
                : "Chargement de l'auto-évaluation RH impossible.")
          );
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
  }, [assistantMode]);

  const activeSection = sections.find((section) => Number(section.id) === Number(activeSectionId)) || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const completedSections = sections.filter((section) => getSectionProgress(section) === 100).length;
  const progress = Math.round(
    sections.reduce((total, section) => total + getSectionProgress(section), 0) / (sections.length || 1)
  );
  const averageScore = useMemo(() => getPageAverage(activePage), [activePage]);
  const associateRecipients = evaluationData?.submitted_to || [];
  const visibleAssociateRecipients = assistantMode
    ? associateRecipients.filter((recipient) => normalizeDepartmentLabel(recipient?.department) !== "CAPITAL HUMAIN")
    : associateRecipients;

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

  async function persistSections(nextSections = sections, successMessage = workflow.saveMessage) {
    try {
      setIsSaving(true);
      setFeedbackMessage("");
      const response = await (assistantMode ? saveAssistantRhSelfEvaluation : saveRhSelfEvaluation)({
        sections: nextSections,
      });

      setEvaluationData(response);
      setSections(response.evaluation.sections || []);
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
    if (String(activeSection?.comment || "").trim().length < 3) {
      setFeedbackTone("error");
      setFeedbackMessage("Le commentaire de section d'au moins 3 caractères est obligatoire avant de continuer.");
      return;
    }

    await persistSections(sections, workflow.saveMessage);
    goToStep(1);
  }

  async function handleSubmit() {
    if (!hasRequiredSubmissionComment(sections)) {
      setFeedbackTone("error");
      setFeedbackMessage("Un commentaire d'au moins 3 caractères est obligatoire pour chaque section avant soumission.");
      return;
    }

    const savedEvaluation = await persistSections(sections, workflow.readyMessage);

    if (!savedEvaluation) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await (assistantMode ? submitAssistantRhSelfEvaluation : submitRhSelfEvaluation)();
      setEvaluationData(response);
      setSections(response.evaluation.sections || []);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || workflow.submittedMessage);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement de l'auto-évaluation RH...
      </section>
    );
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!evaluationData || !sections.length || !activeSection || !activePage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucune matrice RH disponible.</section>;
  }

  const isLastStep =
    Number(activeSectionId) === Number(sections[sections.length - 1]?.id) &&
    activePageIndex === (activeSection.pages?.length || 1) - 1;

  return (
    <div className="space-y-4">
      <div className="rounded-sm bg-[#DCECCB] px-4 py-3 text-xs font-semibold text-[#1E5B34]">
        {workflow.introMessage}
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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-5">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">{evaluationData.evaluation.cycle_label}</p>
            <h2 className="mt-1 text-2xl font-black text-[#0F3A63]">{workflow.titleLabel}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {assistantMode ? `Transmission : ${workflow.recipientRoleLabel}` : `${evaluationData.rh.name} - ${evaluationData.rh.department}`}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#0D496A] p-4 text-white">
                <p className="text-xs font-bold">Progression</p>
                <p className={`mt-2 text-2xl font-black ${getProgressToneClass(progress)}`}>{progress}%</p>
              </div>
              <div className="rounded-lg bg-[#0D496A] p-4 text-white">
                <p className="text-xs font-bold">Score moyen</p>
                <p className="mt-2 text-2xl font-black text-[#86EFAC]">
                  {evaluationData.summary.overallAverage ?? "--"}/5
                </p>
              </div>
            </div>
          </article>

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
                <p>Vous saisissez votre auto-évaluation RH</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2AA7D6] text-white">
                  1
                </span>
                <div>
              <p>Soumission au destinataire</p>
              <p className="text-[11px] text-slate-400">
                Après complétion de toutes les sections de la matrice RH
              </p>
            </div>
          </div>
          {visibleAssociateRecipients.map((recipient, index) => (
            <div key={recipient.id} className="flex items-start gap-3">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                {index + 2}
              </span>
              <p>
                {workflow.recipientRoleLabel} destinataire - {recipient.name} ({getRhRecipientRoleLabel(recipient)})
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
              <p className="mb-2 text-xs font-semibold text-[#79B742]">
                Commentaire de section obligatoire <span className="text-red-600">*</span>
              </p>
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
                    Section suivante
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
                  disabled={
                    isSaving ||
                    isSubmitting ||
                    evaluationData.evaluation.status === "Soumis aux Associés" ||
                    evaluationData.evaluation.status === "Soumis aux Associes" ||
                    evaluationData.evaluation.status === "Soumis à la RH" ||
                    evaluationData.evaluation.status === "Soumis a RH"
                  }
                  className="rounded-md bg-[#79B742] px-8 py-2 text-xs font-semibold text-white disabled:opacity-70"
                >
                  {isSubmitting ? "Soumission..." : workflow.submitButtonLabel}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default MonautoevaluationRH;
