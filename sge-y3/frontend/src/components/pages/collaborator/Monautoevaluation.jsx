import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { saveMyAssistantEvaluation, submitMyAssistantEvaluation } from "@/lib/collaboratorEvaluation";

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - a ameliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - depasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excellent - référence dans l'équipe", color: "text-[#76B82A]" },
];

function getSectionProgress(section) {
  const answered = section.criteria.filter((criterion) => criterion.score !== null && criterion.score !== undefined).length;
  return Math.round((answered / section.criteria.length) * 100);
}

function ScoreRow({ label, selected, onSelect }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-[#0F3A63]">{label}</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            onClick={() => onSelect(score)}
            className={`inline-flex h-6 w-8 items-center justify-center rounded text-[12px] font-bold ${
              selected === score ? "bg-[#0B4C7A] text-white" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-[3px] w-28 rounded-full bg-slate-300">
          <div className="h-[3px] rounded-full bg-[#76B82A]" style={{ width: `${selected ? selected * 20 : 0}%` }} />
        </div>
        <span className={`text-[10px] font-semibold ${selected ? "text-[#76B82A]" : "text-slate-400"}`}>
          {selected ? `${selected * 20}%` : "--%"}
        </span>
      </div>
    </div>
  );
}

function Monautoevaluation({ evaluationData, onEvaluationChange, onSubmitted }) {
  const [sections, setSections] = useState(() => evaluationData?.evaluation?.sections || []);
  const [activeSectionId, setActiveSectionId] = useState(Number(evaluationData?.evaluation?.activeSectionId || 1));
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("success");
  const [savedComments, setSavedComments] = useState(() =>
    Object.fromEntries(
      (evaluationData?.evaluation?.sections || [])
        .filter((section) => section.comment?.trim())
        .map((section) => [section.id, section.comment.trim()])
    )
  );

  const activeSection = sections.find((section) => Number(section.id) === Number(activeSectionId)) || sections[0];
  const completedSections = sections.filter((section) => section.status === "Complete").length;
  const globalProgress = Math.round(
    sections.reduce((total, section) => total + getSectionProgress(section), 0) / (sections.length || 1)
  );
  const averageScore = useMemo(() => {
    const scores = activeSection?.criteria?.map((criterion) => criterion.score).filter((score) => typeof score === "number") || [];
    if (!scores.length) return "--";
    return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
  }, [activeSection]);

  const syncSections = (updater) => {
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
    setSaved(false);
    setFeedbackMessage("");
  };

  const updateScore = (criterionLabel, score) => {
    syncSections((currentSections) =>
      currentSections.map((section) => {
        if (Number(section.id) !== Number(activeSectionId)) return section;
        return {
          ...section,
          criteria: section.criteria.map((criterion) =>
            criterion.label === criterionLabel ? { ...criterion, score } : criterion
          ),
        };
      })
    );
  };

  const updateComment = (comment) => {
    syncSections((currentSections) =>
      currentSections.map((section) => (Number(section.id) === Number(activeSectionId) ? { ...section, comment } : section))
    );
  };

  const persistSections = async (nextSections = sections) => {
    setIsSaving(true);

    try {
      const response = await saveMyAssistantEvaluation(nextSections);
      setSections(response.evaluation.sections);
      setSaved(true);
      setFeedbackTone("success");
      setFeedbackMessage(response.message || "Sauvegarde réussie.");

        const currentSection = response.evaluation.sections.find((section) => Number(section.id) === Number(activeSectionId));
      if (currentSection?.comment?.trim()) {
        setSavedComments((comments) => ({ ...comments, [activeSectionId]: currentSection.comment.trim() }));
      }

      onEvaluationChange?.(response);
      return response;
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Sauvegarde impossible.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const goToSection = (direction) => {
    const nextId = activeSectionId + direction;
    if (nextId >= 1 && nextId <= sections.length) {
      setActiveSectionId(nextId);
      setSaved(false);
      setFeedbackMessage("");
    }
  };

  const handleSaveAndContinue = async () => {
    const response = await persistSections(sections);
    if (response) {
      goToSection(1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const savedResponse = await persistSections(sections);
      if (!savedResponse) {
        return;
      }

      const submittedResponse = await submitMyAssistantEvaluation();
      setSections(submittedResponse.evaluation.sections);
      setFeedbackTone("success");
      setFeedbackMessage(submittedResponse.message || "Auto-évaluation soumise.");
      onEvaluationChange?.(submittedResponse);
      onSubmitted?.(submittedResponse);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(error.message || "Soumission impossible.");

      const firstMissingSection = error?.details?.missingAnswers?.[0]?.sectionId;
      if (firstMissingSection) {
        setActiveSectionId(Number(firstMissingSection));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeSection) {
    return (
      <div className="rounded-md bg-white p-4 shadow-sm text-sm font-semibold text-slate-500">
        Chargement de l'auto-évaluation...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-slate-500">
        {evaluationData?.assignee?.current_cycle || "Cycle 2026"} - Formulaire en cours - Sauvegarde progressive activée
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <p className="font-semibold text-[#0F3A63]">
          Dernière sauvegarde : {evaluationData?.evaluation?.last_saved_at ? "enregistrée" : "non disponible"}
        </p>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#0F3A63]">Section {activeSectionId} / 4</span>
          <button onClick={() => persistSections(sections)} className="font-semibold text-[#76B82A] hover:underline">
            {isSaving ? "Sauvegarde..." : "Sauvegarder maintenant"}
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => {
          const progress = getSectionProgress(section);
          const done = section.status === "Complete";
          return (
            <button
              key={section.id}
              onClick={() => {
                setActiveSectionId(Number(section.id));
                setSaved(false);
                setFeedbackMessage("");
              }}
              className={`rounded-md border px-3 py-2 text-left text-white transition focus:outline-none ${
                Number(activeSectionId) === Number(section.id)
                  ? "border-[#76B82A] bg-[#003B63] shadow-[0_0_0_1px_#76B82A]"
                  : "border-transparent bg-[#003B63] hover:bg-[#0B4C7A]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-bold">{section.title || `Section ${section.id}`}</h2>
                {done ? <Check size={14} className="text-white" /> : null}
              </div>
              <p className="text-[12px] font-semibold">{section.subtitle || "A compléter"}</p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                <div className={`h-1.5 rounded-full ${done ? "bg-[#7BC443]" : "bg-[#D6DCE2]"}`} style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-[10px] font-semibold text-slate-200">
                {done ? "Complete" : progress ? `En cours -> ${progress}%` : "A faire"}
              </p>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <article className="rounded-md bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[30px] font-bold leading-none text-[#0F3A63]">
                {(activeSection.title || `Section ${activeSection.id}`)} - {(activeSection.subtitle || "A compléter")}
              </h3>
              <p className="mt-2 text-[12px] font-semibold text-slate-500">Score moyen : {averageScore} / 5</p>
            </div>
            <span className="text-[16px] font-bold text-[#32B3E0]">{activeSection.status}</span>
          </div>

          <div className="space-y-3.5">
            {activeSection.criteria.map((item) => (
              <ScoreRow
                key={item.label}
                label={item.label}
                selected={item.score}
                onSelect={(score) => updateScore(item.label, score)}
              />
            ))}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire de section (facultatif)</p>
            <textarea
              rows={4}
              value={activeSection.comment}
              onChange={(event) => updateComment(event.target.value)}
              placeholder="Points forts, exemples concrets, contexte..."
              className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
            />
          </div>

          {savedComments[activeSectionId] ? (
            <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2">
              <p className="text-[10px] font-bold text-[#5A8A3A]">Commentaire sauvegardé</p>
              <p className="mt-1 text-[11px] font-semibold text-[#0F3A63]">{savedComments[activeSectionId]}</p>
            </div>
          ) : null}

          <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
            Les questions obligatoires sans réponse bloqueront la soumission à la RH.
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => goToSection(-1)}
              disabled={activeSectionId === 1}
              className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={14} />
              Section précédente
            </button>

            <div className="flex flex-wrap items-center gap-3">
              {activeSectionId < sections.length ? (
                <button
                  onClick={handleSaveAndContinue}
                  disabled={isSaving || isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                >
                  Sauvegarder et continuer
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSaving || isSubmitting || evaluationData?.evaluation?.status === "Soumis a RH"}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0B4C7A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-70"
                >
                  {isSubmitting ? "Soumission..." : "Soumettre à la RH"}
                </button>
              )}
            </div>
          </div>

          {feedbackMessage ? (
            <p className={`mt-2 text-right text-[11px] font-semibold ${feedbackTone === "error" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
              {feedbackMessage}
            </p>
          ) : saved ? (
            <p className="mt-2 text-right text-[11px] font-semibold text-[#76B82A]">Sauvegarde réussie.</p>
          ) : null}
        </article>

        <div className="space-y-4">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[22px] font-bold text-[#0F3A63]">Progression globale</h3>
              <span className="text-[13px] font-bold text-[#76B82A]">{globalProgress}%</span>
            </div>
            <p className="mb-4 text-[12px] font-semibold text-[#76B82A]">{completedSections} section(s) completé(s)</p>

            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.id} className="flex items-center justify-between text-[12px]">
                  <p className="font-semibold text-[#0F3A63]">{section.subtitle}</p>
                  <span className="font-bold text-[#76B82A]">{getSectionProgress(section)}%</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Aide à la notation</h3>
            <div className="space-y-2">
              {gradingHelp.map((item) => (
                <div key={item.level} className="flex items-center gap-2 text-[12px]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 font-bold text-slate-500">
                    {item.level}
                  </span>
                  <p className={`font-semibold ${item.color}`}>{item.text}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default Monautoevaluation;
