import { useMemo, useState } from "react";
import { initialQuestionSections } from "@/components/pages/rh/rhData";

function QuestionnaireRH() {
  const [sections, setSections] = useState(initialQuestionSections);
  const [selectedSectionId, setSelectedSectionId] = useState(initialQuestionSections[0].id);
  const [questionText, setQuestionText] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionAudience, setSectionAudience] = useState("Tous collaborateurs");
  const [status, setStatus] = useState("");

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) || sections[0],
    [sections, selectedSectionId]
  );

  const addQuestion = () => {
    const nextQuestion = questionText.trim();
    if (!nextQuestion || !selectedSection) {
      setStatus("Sélectionnez une section et renseignez une question.");
      return;
    }

    setSections((currentSections) =>
      currentSections.map((section) =>
        section.id === selectedSection.id ? { ...section, questions: [...section.questions, nextQuestion] } : section
      )
    );
    setQuestionText("");
    setStatus("Question ajoutée à la section.");
  };

  const createSection = () => {
    const nextTitle = sectionTitle.trim();
    if (!nextTitle) {
      setStatus("Renseignez le nom de la nouvelle section.");
      return;
    }

    const nextSection = {
      id: `${Date.now()}-${nextTitle.toLowerCase().replace(/\s+/g, "-")}`,
      title: nextTitle,
      audience: sectionAudience,
      questions: [],
    };

    setSections((currentSections) => [...currentSections, nextSection]);
    setSelectedSectionId(nextSection.id);
    setSectionTitle("");
    setSectionAudience("Tous collaborateurs");
    setStatus("Section créée. Vous pouvez maintenant ajouter des questions.");
  };

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Sections existantes</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            La RH peut enrichir le questionnaire d'évaluation utilisé pendant le cycle.
          </p>
        </div>

        <div className="space-y-3">
          {sections.map((section) => {
            const isSelected = selectedSection?.id === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  isSelected ? "border-[#8BC53F] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold text-[#0F3A63]">{section.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{section.audience}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">
                    {section.questions.length} question(s)
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </article>

      <div className="space-y-5">
        <article className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Ajouter une question</h2>
          <label htmlFor="question-section" className="mt-4 block text-xs font-bold uppercase text-slate-500">
            Section
          </label>
          <select
            id="question-section"
            value={selectedSection?.id || ""}
            onChange={(event) => setSelectedSectionId(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-bold text-[#0F3A63] outline-none"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>

          <textarea
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            placeholder="Saisir la nouvelle question..."
            className="mt-3 min-h-[92px] w-full resize-none rounded-md bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
          />

          <button onClick={addQuestion} className="mt-3 rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-bold text-white">
            Ajouter la question
          </button>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Créer une section</h2>
          <input
            value={sectionTitle}
            onChange={(event) => setSectionTitle(event.target.value)}
            placeholder="Nom de la section"
            className="mt-4 h-10 w-full rounded-md bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
          />
          <select
            value={sectionAudience}
            onChange={(event) => setSectionAudience(event.target.value)}
            className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-bold text-[#0F3A63] outline-none"
          >
            <option>Tous collaborateurs</option>
            <option>Managers</option>
            <option>Seniors</option>
            <option>Collaborateurs</option>
            <option>Assistants</option>
          </select>
          <button onClick={createSection} className="mt-3 rounded-full bg-[#0D496A] px-5 py-2 text-sm font-bold text-white">
            Créer la section
          </button>
        </article>
      </div>

      <article className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
        <h2 className="text-xl font-extrabold text-[#0F3A63]">Questions de la section sélectionnée</h2>
        {selectedSection ? (
          <div className="mt-4 space-y-3">
            {selectedSection.questions.length ? (
              selectedSection.questions.map((question, index) => (
                <div key={`${selectedSection.id}-${question}`} className="rounded-lg bg-[#F8FAFC] px-4 py-3">
                  <p className="text-xs font-bold uppercase text-slate-400">Question {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F3A63]">{question}</p>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-slate-500">
                Aucune question dans cette section pour le moment.
              </p>
            )}
          </div>
        ) : null}
        {status ? <p className="mt-4 text-sm font-bold text-[#78B843]">{status}</p> : null}
      </article>
    </section>
  );
}

export default QuestionnaireRH;
