import { useEffect, useMemo, useState } from "react";
import {
  addRhQuestionnaireQuestion,
  createRhQuestionnaireSection,
  getRhQuestionnaire,
} from "@/lib/rhOverview";

function QuestionnaireRH() {
  const [questionnaireData, setQuestionnaireData] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionAudience, setSectionAudience] = useState("Tous collaborateurs");
  const [sectionKey, setSectionKey] = useState("SAVOIR FAIRE");
  const [sourceSheet, setSourceSheet] = useState("CAPITAL HUMAIN");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("success");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isCreatingSection, setIsCreatingSection] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestionnaire() {
      try {
        setIsLoading(true);
        const response = await getRhQuestionnaire();

        if (cancelled) return;

        setQuestionnaireData(response);
        setSelectedSectionId(
          (current) => current || response.sections?.[0]?.id || "",
        );
        if (
          response.options?.sourceSheets?.some(
            (option) => option.value === "CAPITAL HUMAIN",
          )
        ) {
          setSourceSheet("CAPITAL HUMAIN");
        } else if (response.options?.sourceSheets?.[0]?.value) {
          setSourceSheet(response.options.sourceSheets[0].value);
        }
      } catch (error) {
        if (!cancelled) {
          setStatusTone("error");
          setStatus(
            error.message || "Chargement du questionnaire RH impossible.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadQuestionnaire();

    return () => {
      cancelled = true;
    };
  }, []);

  const sections = questionnaireData?.sections || [];
  const options = questionnaireData?.options || {
    sourceSheets: [],
    sectionKeys: [],
    audiences: [],
  };
  const selectedSection = useMemo(
    () =>
      sections.find((section) => section.id === selectedSectionId) ||
      sections[0],
    [sections, selectedSectionId],
  );

  useEffect(() => {
    if (!selectedSectionId && sections[0]?.id) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  async function handleAddQuestion() {
    if (!selectedSection?.id || !questionText.trim()) {
      setStatusTone("error");
      setStatus("Selectionnez une section et renseignez une question.");
      return;
    }

    try {
      setIsSavingQuestion(true);
      const response = await addRhQuestionnaireQuestion({
        sectionId: selectedSection.id,
        questionText,
      });

      setQuestionnaireData(response);
      setQuestionText("");
      setStatusTone("success");
      setStatus(response.message || "Question ajoutee a la section.");
    } catch (error) {
      setStatusTone("error");
      setStatus(error.message || "Ajout de la question impossible.");
    } finally {
      setIsSavingQuestion(false);
    }
  }

  async function handleCreateSection() {
    if (!sectionTitle.trim() || !sourceSheet || !sectionKey) {
      setStatusTone("error");
      setStatus("Renseignez le departement, le bloc et le nom de la section.");
      return;
    }

    try {
      setIsCreatingSection(true);
      const response = await createRhQuestionnaireSection({
        title: sectionTitle,
        sourceSheet,
        sectionKey,
        audience: sectionAudience,
      });

      const createdSection = response.sections?.find(
        (section) =>
          section.title === sectionTitle.trim() &&
          section.sourceSheet === sourceSheet &&
          section.sectionKey === sectionKey &&
          section.isCustom,
      );

      setQuestionnaireData(response);
      setSelectedSectionId(createdSection?.id || selectedSectionId);
      setSectionTitle("");
      setSectionAudience("Tous collaborateurs");
      setStatusTone("success");
      setStatus(
        response.message ||
          "Section creee. Vous pouvez maintenant ajouter des questions.",
      );
    } catch (error) {
      setStatusTone("error");
      setStatus(error.message || "Creation de la section impossible.");
    } finally {
      setIsCreatingSection(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement du questionnaire RH...
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold text-[#0F3A63]">
          Ajouter une question
        </h2>
        <label
          htmlFor="question-section"
          className="mt-4 block text-xs font-bold uppercase text-slate-500"
        >
          Section / titre cible
        </label>
        <select
          id="question-section"
          value={selectedSection?.id || ""}
          onChange={(event) => setSelectedSectionId(event.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-bold text-[#0F3A63] outline-none"
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.sourceLabel} - {section.title}
            </option>
          ))}
        </select>

        <textarea
          value={questionText}
          onChange={(event) => setQuestionText(event.target.value)}
          placeholder="Saisir la nouvelle question..."
          className="mt-3 min-h-[92px] w-full resize-none rounded-md bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
        />

        <button
          type="button"
          onClick={handleAddQuestion}
          disabled={isSavingQuestion}
          className="mt-3 rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-bold text-white disabled:opacity-70"
        >
          {isSavingQuestion ? "Ajout..." : "Ajouter la question"}
        </button>
      </article>

      <article className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold text-[#0F3A63]">
          Creer une section
        </h2>
        <label
          htmlFor="source-sheet"
          className="mt-4 block text-xs font-bold uppercase text-slate-500"
        >
          Departement / feuille
        </label>
        <select
          id="source-sheet"
          value={sourceSheet}
          onChange={(event) => setSourceSheet(event.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-bold text-[#0F3A63] outline-none"
        >
          {options.sourceSheets.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label
          htmlFor="section-key"
          className="mt-3 block text-xs font-bold uppercase text-slate-500"
        >
          Bloc de matrice
        </label>
        <select
          id="section-key"
          value={sectionKey}
          onChange={(event) => setSectionKey(event.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-bold text-[#0F3A63] outline-none"
        >
          {options.sectionKeys.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          value={sectionTitle}
          onChange={(event) => setSectionTitle(event.target.value)}
          placeholder="Nom du titre / de la section"
          className="mt-3 h-10 w-full rounded-md bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
        />

        <select
          value={sectionAudience}
          onChange={(event) => setSectionAudience(event.target.value)}
          className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-bold text-[#0F3A63] outline-none"
        >
          {options.audiences.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleCreateSection}
          disabled={isCreatingSection}
          className="mt-3 rounded-full bg-[#0D496A] px-5 py-2 text-sm font-bold text-white disabled:opacity-70"
        >
          {isCreatingSection ? "Creation..." : "Creer la section"}
        </button>
      </article>

      <article className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
        <h2 className="text-xl font-extrabold text-[#0F3A63]">
          Questions de la section selectionnee
        </h2>
        {selectedSection ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-bold uppercase text-slate-400">
                Parametres de matrice
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0F3A63]">
                {selectedSection.sourceLabel} - {selectedSection.sectionTitle}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {selectedSection.audience}
              </p>
            </div>

            {selectedSection.questions.length ? (
              selectedSection.questions.map((question, index) => (
                <div
                  key={`${selectedSection.id}-${question}-${index}`}
                  className="rounded-lg bg-[#F8FAFC] px-4 py-3"
                >
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Question {index + 1}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#0F3A63]">
                    {question}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-slate-500">
                Aucune question dans cette section pour le moment.
              </p>
            )}
          </div>
        ) : null}

        {status ? (
          <p
            className={`mt-4 text-sm font-bold ${statusTone === "error" ? "text-[#C24141]" : "text-[#78B843]"}`}
          >
            {status}
          </p>
        ) : null}
      </article>
    </section>
  );
}

export default QuestionnaireRH;
