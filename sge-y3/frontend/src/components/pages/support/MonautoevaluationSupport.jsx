import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";
import {
  getSupportSelfEvaluation,
  saveSupportSelfEvaluation,
  submitSupportSelfEvaluation,
} from "@/lib/supportEvaluation";

function getSupportRoleKey(user) {
  return user?.grade || "Service support";
}

function getSectionProgress(section) {
  const themes = (section?.pages || []).flatMap((page) => page.themes || []);
  if (!themes.length) return 0;
  return Math.round((themes.filter((theme) => Number.isFinite(theme.score)).length / themes.length) * 100);
}

function getPageProgress(page) {
  const themes = page?.themes || [];
  if (!themes.length) return 0;
  return Math.round((themes.filter((theme) => Number.isFinite(theme.score)).length / themes.length) * 100);
}

function getAverageScore(sections = []) {
  const scores = sections
    .flatMap((section) => section.pages || [])
    .flatMap((page) => page.themes || [])
    .map((theme) => theme.score)
    .filter(Number.isFinite);

  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function getEvaluationGroupKey(section) {
  const hasDomainPage = (section?.pages || []).some((page) => page.source_sheet && page.source_sheet !== "TRONC COMMUN");
  return hasDomainPage ? "domain" : "common";
}

function getGroupStats(sections = []) {
  const themes = sections.flatMap((section) => section.pages || []).flatMap((page) => page.themes || []);
  const answered = themes.filter((theme) => Number.isFinite(theme.score)).length;
  const progress = themes.length ? Math.round((answered / themes.length) * 100) : 0;

  return {
    answered,
    total: themes.length,
    progress,
    average: getAverageScore(sections),
  };
}

function ScoreButtons({ value, onChange }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className={`h-8 w-9 border-r border-slate-200 text-xs font-bold last:border-0 ${
            value === score ? "bg-[#0F3A63] text-white" : "bg-white text-[#0F3A63] hover:bg-slate-100"
          }`}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

function MonautoevaluationSupport({ user }) {
  const roleKey = getSupportRoleKey(user);
  const [sections, setSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [activeEvaluationGroup, setActiveEvaluationGroup] = useState("common");
  const [pageIndexes, setPageIndexes] = useState({});
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      try {
        setIsLoading(true);
        const response = await getSupportSelfEvaluation();
        const nextSections = response?.evaluation?.sections || [];

        if (cancelled) return;
        setSections(nextSections);
        const firstCommonSection = nextSections.find((section) => getEvaluationGroupKey(section) === "common");
        setActiveSectionId(firstCommonSection?.id || nextSections[0]?.id || "");
      } catch (error) {
        if (!cancelled) setStatus(error.message || "Chargement impossible.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadEvaluation();
    return () => {
      cancelled = true;
    };
  }, []);

  const commonSections = useMemo(() => sections.filter((section) => getEvaluationGroupKey(section) === "common"), [sections]);
  const domainSections = useMemo(() => sections.filter((section) => getEvaluationGroupKey(section) === "domain"), [sections]);
  const visibleSections = activeEvaluationGroup === "domain" ? domainSections : commonSections;
  const activeSection = visibleSections.find((section) => section.id === activeSectionId) || visibleSections[0] || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const totalQuestions = sections.flatMap((section) => section.pages || []).flatMap((page) => page.themes || []).length;
  const answeredQuestions = sections
    .flatMap((section) => section.pages || [])
    .flatMap((page) => page.themes || [])
    .filter((theme) => Number.isFinite(theme.score)).length;
  const progress = totalQuestions ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const average = useMemo(() => getAverageScore(sections), [sections]);
  const commonStats = useMemo(() => getGroupStats(commonSections), [commonSections]);
  const domainStats = useMemo(() => getGroupStats(domainSections), [domainSections]);

  const activeSectionIndex = visibleSections.findIndex((section) => section.id === activeSection?.id);
  const isFirstPage = activeSectionIndex === 0 && activePageIndex === 0;
  const isLastPage = activeSectionIndex === visibleSections.length - 1 && activePageIndex === (activeSection?.pages?.length || 1) - 1;

  function setActivePageIndex(sectionId, index) {
    setPageIndexes((current) => ({ ...current, [sectionId]: index }));
  }

  function updateThemeScore(themeId, score) {
    setSections((current) =>
      current.map((section) =>
        section.id !== activeSection.id
          ? section
          : {
              ...section,
              pages: section.pages.map((page, pageIndex) =>
                pageIndex !== activePageIndex
                  ? page
                  : {
                      ...page,
                      themes: page.themes.map((theme) =>
                        (theme.theme_id || theme.id) === themeId ? { ...theme, score } : theme
                      ),
                    }
              ),
            }
      )
    );
    setStatus("");
  }

  function updatePageComment(comment) {
    setSections((current) =>
      current.map((section) =>
        section.id !== activeSection.id
          ? section
          : {
              ...section,
              pages: section.pages.map((page, pageIndex) => (pageIndex === activePageIndex ? { ...page, comment } : page)),
            }
      )
    );
    setStatus("");
  }

  function goToPage(direction) {
    const nextPageIndex = activePageIndex + direction;
    if (nextPageIndex >= 0 && nextPageIndex < activeSection.pages.length) {
      setActivePageIndex(activeSection.id, nextPageIndex);
      return;
    }

    const nextSection = visibleSections[activeSectionIndex + direction];
    if (!nextSection) return;

    setActiveSectionId(nextSection.id);
    setActivePageIndex(nextSection.id, direction > 0 ? 0 : nextSection.pages.length - 1);
  }

  function selectEvaluationGroup(groupKey) {
    const nextSections = groupKey === "domain" ? domainSections : commonSections;
    setActiveEvaluationGroup(groupKey);
    setActiveSectionId(nextSections[0]?.id || "");
    setStatus("");
  }

  async function saveDraft() {
    try {
      const response = await saveSupportSelfEvaluation({ sections });
      const nextSections = response?.evaluation?.sections || sections;
      setSections(nextSections);
      setStatus(response.message || "Auto-évaluation support enregistrée.");
    } catch (error) {
      setStatus(error.message || "Enregistrement impossible.");
    }
  }

  async function submitToAssociates() {
    if (answeredQuestions < totalQuestions) {
      setStatus("Toutes les questions doivent être renseignées avant la soumission.");
      return;
    }

    try {
      await saveSupportSelfEvaluation({ sections });
      const response = await submitSupportSelfEvaluation();
      const nextSections = response?.evaluation?.sections || sections;
      setSections(nextSections);
      setStatus(response.message || "Auto-évaluation support soumise directement aux associés.");
    } catch (error) {
      setStatus(error.message || "Soumission impossible.");
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement de l'auto-évaluation support...
      </section>
    );
  }

  if (!sections.length || !activeSection || !activePage) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Aucune matrice support disponible pour ce profil.
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase text-slate-400">Département support</p>
        <h2 className="mt-1 text-2xl font-black text-[#0F3A63]">Mon auto-évaluation</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {user?.first_name} {user?.last_name} - {roleKey} - Soumission directe aux associés.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-xs font-bold">Progression</p>
            <p className={`mt-2 text-2xl font-black ${getProgressToneClass(progress)}`}>{progress}%</p>
          </div>
          <div className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-xs font-bold">Score moyen</p>
            <p className="mt-2 text-2xl font-black text-[#86EFAC]">{average}/5</p>
          </div>
          <div className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-xs font-bold">Questions</p>
            <p className="mt-2 text-2xl font-black text-[#86EFAC]">
              {answeredQuestions}/{totalQuestions}
            </p>
          </div>
        </div>
      </article>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          {
            key: "common",
            title: "Évaluation du tronc commun",
            subtitle: "Questions communes aux autres profils",
            stats: commonStats,
          },
          {
            key: "domain",
            title: `Évaluation ${roleKey}`,
            subtitle: "Questions propres au domaine",
            stats: domainStats,
          },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => selectEvaluationGroup(item.key)}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              activeEvaluationGroup === item.key ? "border-[#76B82A] bg-[#EEF6E8]" : "border-white bg-white hover:border-[#D9E3EE]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#0F3A63]">{item.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{item.subtitle}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#0F4A72]">
                {item.stats.progress}%
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white p-3">
                <p className="text-[11px] font-bold text-slate-500">Questions</p>
                <p className="mt-1 text-lg font-black text-[#0F3A63]">
                  {item.stats.answered}/{item.stats.total}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3">
                <p className="text-[11px] font-bold text-slate-500">Moyenne</p>
                <p className="mt-1 text-lg font-black text-[#76B82A]">{item.stats.average}/5</p>
              </div>
            </div>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.6fr]">
        <aside className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-extrabold text-[#0F4A72]">Sections</p>
          {visibleSections.map((section) => {
            const isActive = activeSection.id === section.id;
            const sectionProgress = getSectionProgress(section);

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSectionId(section.id);
                  setStatus("");
                }}
                className={`w-full rounded-md border p-3 text-left transition ${
                  isActive ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-slate-50 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#0F3A63]">{section.title}</p>
                  {sectionProgress === 100 ? <Check size={14} className="text-[#76B82A]" /> : null}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{section.pages.length} titre(s)</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                  <div className={`h-1.5 rounded-full ${getProgressBarClass(sectionProgress)}`} style={{ width: `${clampProgress(sectionProgress)}%` }} />
                </div>
              </button>
            );
          })}
        </aside>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">{activeSection.title}</p>
              <h3 className="mt-1 text-xl font-black text-[#0F3A63]">{activePage.title}</h3>
            </div>
            <span className="rounded-full bg-[#EEF6E8] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
              Titre {activePageIndex + 1} / {activeSection.pages.length}
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {activeSection.pages.map((page, index) => (
              <button
                key={page.page_id || page.id}
                type="button"
                onClick={() => setActivePageIndex(activeSection.id, index)}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  index === activePageIndex
                    ? "border-[#76B82A] bg-[#F3FAEA] text-[#0F3A63]"
                    : "border-[#D9E3EE] bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <p className="text-[11px] font-bold">Titre {index + 1}</p>
                <p className="mt-1 text-[12px] font-semibold">{page.title}</p>
                <p className={`mt-1 text-[10px] font-semibold ${getProgressToneClass(getPageProgress(page))}`}>{getPageProgress(page)}%</p>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {activePage.themes.map((theme) => (
              <div key={theme.theme_id || theme.id} className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-4">
                <div className="mb-3">
                  <p className="text-sm font-bold text-[#0F3A63]">
                    {theme.code}. {theme.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{theme.statement}</p>
                </div>
                <ScoreButtons value={theme.score} onChange={(score) => updateThemeScore(theme.theme_id || theme.id, score)} />
              </div>
            ))}
          </div>

          <textarea
            value={activePage.comment || ""}
            onChange={(event) => updatePageComment(event.target.value)}
            placeholder="Commentaire sur ce titre..."
            className="mt-4 min-h-[90px] w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-[#0F3A63] outline-none"
          />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToPage(-1)}
              disabled={isFirstPage}
              className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={14} />
              Précédent
            </button>
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={isLastPage}
              className="inline-flex items-center gap-2 rounded-md bg-[#0C4B6C] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
              <ChevronRight size={14} />
            </button>
          </div>
        </article>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {status ? (
          <p className={`text-sm font-bold ${answeredQuestions < totalQuestions ? "text-[#B56B00]" : "text-[#4E8B1B]"}`}>{status}</p>
        ) : null}
        <button onClick={saveDraft} className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-[#0F3A63] shadow-sm">
          Enregistrer
        </button>
        <button onClick={submitToAssociates} className="rounded-full bg-[#0F3A63] px-6 py-3 text-sm font-extrabold text-white">
          Soumettre aux associés
        </button>
      </div>
    </section>
  );
}

export default MonautoevaluationSupport;
