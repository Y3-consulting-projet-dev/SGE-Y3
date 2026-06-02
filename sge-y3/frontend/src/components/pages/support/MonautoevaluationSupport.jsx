import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { clampProgress, getProgressBarClass, getProgressToneClass } from "@/lib/progressPresentation";
import matrixData from "../../../../../backend/src/data/competencyMatrix.generated.json";

const SUPPORT_ROLE_BY_EMAIL = {
  "fleur.nguessan@ycubeac.com": "Office Manager",
  "aziz.ouattara@ycubeac.com": "PMO",
  "porthela.kakou@ycubeac.com": "Responsable IT",
  "adele.creppy@ycubeac.com": "Comptable Interne Senior",
};

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getSupportRoleKey(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (SUPPORT_ROLE_BY_EMAIL[email]) return SUPPORT_ROLE_BY_EMAIL[email];

  const source = normalizeText(`${user?.grade || ""} ${user?.department || ""} ${user?.name || ""}`);

  if (source.includes("PMO")) return "PMO";
  if (source.includes("RESPONSABLE IT") || source.includes("IT")) return "Responsable IT";
  if (source.includes("COMPTABLE INTERNE SENIOR") || source.includes("COMPTABILITE INTERNE SENIOR")) {
    return "Comptable Interne Senior";
  }
  if (source.includes("OFFICE MANAGER")) return "Office Manager";

  return "Office Manager";
}

function getCommonGradeKey(user, supportRoleKey) {
  const source = normalizeText(`${user?.grade || ""} ${user?.code_categorie || ""}`);

  if (source.includes("SENIOR") || source.includes("9A")) return "Senior";
  if (source.includes("ASSISTANT MANAGER") || source.includes("MANAGER") || source.includes("10")) return "Manager";
  if (source.includes("ASSISTANT") || source.includes("8")) return "Assistant";
  if (source.includes("ASSOCIE") || source.includes("ASSOCI") || source.includes("11")) return "Associ?";

  return normalizeText(supportRoleKey).includes("COMPTABLE INTERNE SENIOR") ? "Senior" : "Manager";
}

function getStatementForRole(statements = {}, roleKey) {
  if (statements[roleKey]) return statements[roleKey];

  const normalizedRole = normalizeText(roleKey);
  const matchingKey = Object.keys(statements).find((key) => normalizeText(key) === normalizedRole);
  return matchingKey ? statements[matchingKey] : "";
}

function buildSupportSections(user) {
  const roleKey = getSupportRoleKey(user);
  const supportSheets = [
    { name: "TRONC COMMUN", roleKey: getCommonGradeKey(user, roleKey) },
    { name: "SERVICE SUPPORT", roleKey },
  ];
  const groupedSections = new Map();
  const sectionOrder = [];

  supportSheets.forEach((sheet) => {
    (matrixData[sheet.name] || []).forEach((sourceSection, sourceSectionIndex) => {
    const sectionKey = sourceSection.key || sourceSection.title || `section-${sourceSectionIndex}`;

    if (!groupedSections.has(sectionKey)) {
      sectionOrder.push(sectionKey);
      groupedSections.set(sectionKey, {
        id: slugify(sectionKey),
        title: sourceSection.title || sectionKey,
        pages: [],
      });
    }

    const targetSection = groupedSections.get(sectionKey);

    (sourceSection.pages || []).forEach((page, pageIndex) => {
      const themes = (page.themes || [])
        .map((theme, themeIndex) => {
          const statement = getStatementForRole(theme.statements || {}, sheet.roleKey);
          if (!statement) return null;

          return {
            id: `${slugify(sheet.name)}-${slugify(sheet.roleKey)}-${slugify(sectionKey)}-${slugify(page.title)}-${slugify(theme.code || themeIndex)}`,
            code: theme.code || String.fromCharCode(65 + themeIndex),
            label: theme.label,
            statement,
            score: null,
          };
        })
        .filter(Boolean);

      if (!themes.length) return;

      targetSection.pages.push({
        id: `${slugify(sheet.name)}-${slugify(sheet.roleKey)}-${slugify(sectionKey)}-${slugify(page.title || pageIndex)}`,
        title: page.title || `Titre ${pageIndex + 1}`,
        sourceSheet: sheet.name,
        comment: "",
        themes,
      });
    });
  });
  });

  return sectionOrder.map((sectionKey) => groupedSections.get(sectionKey)).filter((section) => section.pages.length);
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
  const [sections, setSections] = useState(() => buildSupportSections(user));
  const [activeSectionId, setActiveSectionId] = useState(() => buildSupportSections(user)[0]?.id || "");
  const [pageIndexes, setPageIndexes] = useState({});
  const [status, setStatus] = useState("");

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const activePageIndex = pageIndexes[activeSection?.id] || 0;
  const activePage = activeSection?.pages?.[activePageIndex] || activeSection?.pages?.[0];
  const totalQuestions = sections.flatMap((section) => section.pages).flatMap((page) => page.themes).length;
  const answeredQuestions = sections
    .flatMap((section) => section.pages)
    .flatMap((page) => page.themes)
    .filter((theme) => Number.isFinite(theme.score)).length;
  const progress = totalQuestions ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const average = useMemo(() => getAverageScore(sections), [sections]);

  const activeSectionIndex = sections.findIndex((section) => section.id === activeSection?.id);
  const isFirstPage = activeSectionIndex === 0 && activePageIndex === 0;
  const isLastPage = activeSectionIndex === sections.length - 1 && activePageIndex === (activeSection?.pages?.length || 1) - 1;

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
                      themes: page.themes.map((theme) => (theme.id === themeId ? { ...theme, score } : theme)),
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

    const nextSection = sections[activeSectionIndex + direction];
    if (!nextSection) return;

    setActiveSectionId(nextSection.id);
    setActivePageIndex(nextSection.id, direction > 0 ? 0 : nextSection.pages.length - 1);
  }

  function submitToAssociates() {
    if (answeredQuestions < totalQuestions) {
      setStatus("Toutes les questions doivent être renseignées avant la soumission.");
      return;
    }

    setStatus("Auto-évaluation support soumise directement aux associés.");
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
            <p className="mt-2 text-2xl font-black text-[#86EFAC]">{answeredQuestions}/{totalQuestions}</p>
          </div>
        </div>
      </article>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.6fr]">
        <aside className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-extrabold text-[#0F4A72]">Sections</p>
          {sections.map((section) => {
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
                key={page.id}
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
              <div key={theme.id} className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-4">
                <div className="mb-3">
                  <p className="text-sm font-bold text-[#0F3A63]">
                    {theme.code}. {theme.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{theme.statement}</p>
                </div>
                <ScoreButtons value={theme.score} onChange={(score) => updateThemeScore(theme.id, score)} />
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
        <button onClick={submitToAssociates} className="rounded-full bg-[#0F3A63] px-6 py-3 text-sm font-extrabold text-white">
          Soumettre aux associés
        </button>
      </div>
    </section>
  );
}

export default MonautoevaluationSupport;
