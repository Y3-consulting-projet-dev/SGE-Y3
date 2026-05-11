import { useMemo, useState } from "react";

const associateRecipients = ["Yves DODO", "Associés du cabinet"];

const initialSections = [
  {
    id: 1,
    title: "Pilotage du cycle d'évaluation",
    criteria: [
      { label: "Organisation du calendrier d'évaluation", score: null },
      { label: "Suivi des relances et des validations", score: null },
      { label: "Qualité de consolidation des données", score: null },
    ],
    comment: "",
  },
  {
    id: 2,
    title: "Accompagnement des managers",
    criteria: [
      { label: "Support apporté aux managers pendant le cycle", score: null },
      { label: "Clarté des consignes RH", score: null },
      { label: "Traitement des écarts et arbitrages", score: null },
    ],
    comment: "",
  },
  {
    id: 3,
    title: "Confidentialité & conformité",
    criteria: [
      { label: "Respect de la confidentialité des évaluations", score: null },
      { label: "Fiabilité des contrôles RH", score: null },
      { label: "Traçabilité des décisions et validations", score: null },
    ],
    comment: "",
  },
  {
    id: 4,
    title: "Amélioration continue",
    criteria: [
      { label: "Identification des points d'amélioration du processus", score: null },
      { label: "Propositions pour le prochain cycle", score: null },
      { label: "Qualité du reporting aux associés", score: null },
    ],
    comment: "",
  },
];

function getSectionProgress(section) {
  const answered = section.criteria.filter((criterion) => typeof criterion.score === "number").length;
  return Math.round((answered / section.criteria.length) * 100);
}

function getAverage(criteria) {
  const scores = criteria.map((criterion) => criterion.score).filter((score) => typeof score === "number");
  if (!scores.length) return "--";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
}

function ScoreButtons({ selected, onSelect }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onSelect(score)}
          className={`h-8 w-9 border-r border-slate-200 text-xs font-bold last:border-0 ${
            selected === score ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63] hover:bg-slate-100"
          }`}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

function MonautoevaluationRH() {
  const [sections, setSections] = useState(initialSections);
  const [activeSectionId, setActiveSectionId] = useState(initialSections[0].id);
  const [status, setStatus] = useState("");

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const globalProgress = Math.round(
    sections.reduce((total, section) => total + getSectionProgress(section), 0) / sections.length
  );
  const globalAverage = useMemo(() => {
    const scores = sections.flatMap((section) => section.criteria.map((criterion) => criterion.score)).filter((score) => typeof score === "number");
    if (!scores.length) return "--";
    return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
  }, [sections]);

  const updateScore = (criterionLabel, score) => {
    setSections((currentSections) =>
      currentSections.map((section) => {
        if (section.id !== activeSectionId) return section;
        return {
          ...section,
          criteria: section.criteria.map((criterion) =>
            criterion.label === criterionLabel ? { ...criterion, score } : criterion
          ),
        };
      })
    );
    setStatus("");
  };

  const updateComment = (comment) => {
    setSections((currentSections) =>
      currentSections.map((section) => (section.id === activeSectionId ? { ...section, comment } : section))
    );
    setStatus("");
  };

  const saveDraft = () => {
    setStatus("Brouillon enregistré.");
  };

  const submitToAssociates = () => {
    setStatus(`Auto-évaluation RH envoyée aux associés : ${associateRecipients.join(", ")}.`);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-lg bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
        La RH s'auto-évalue sur la conduite du cycle, puis soumet son auto-évaluation aux associés.
      </div>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.35fr]">
        <article className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-400">Cycle 2026</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#0F3A63]">Auto-évaluation RH</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Responsable RH - Capital Humain</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#0D496A] p-4 text-white">
              <p className="text-xs font-bold">Progression</p>
              <p className="mt-2 text-2xl font-black text-[#86EFAC]">{globalProgress}%</p>
            </div>
            <div className="rounded-lg bg-[#0D496A] p-4 text-white">
              <p className="text-xs font-bold">Score moyen</p>
              <p className="mt-2 text-2xl font-black text-[#86EFAC]">{globalAverage}/5</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {sections.map((section) => {
              const progress = getSectionProgress(section);
              const isActive = section.id === activeSectionId;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    isActive ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-[#0F3A63]">{section.title}</p>
                    <span className="text-xs font-bold text-[#76B82A]">{progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                    <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${progress}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-[#0F3A63]">
            Destinataires : {associateRecipients.join(", ")}
          </div> */}
        </article>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#0F3A63]">{activeSection.title}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Score section : {getAverage(activeSection.criteria)} / 5</p>
            </div>
            <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
              {getSectionProgress(activeSection)}%
            </span>
          </div>

          <div className="space-y-4">
            {activeSection.criteria.map((criterion) => (
              <div key={criterion.label} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <p className="text-sm font-semibold text-[#0F3A63]">{criterion.label}</p>
                <ScoreButtons selected={criterion.score} onSelect={(score) => updateScore(criterion.label, score)} />
              </div>
            ))}
          </div>

          <textarea
            rows={4}
            value={activeSection.comment}
            onChange={(event) => updateComment(event.target.value)}
            placeholder="Commentaires, exemples concrets, points d'amélioration..."
            className="mt-5 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
          />

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button onClick={saveDraft} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-bold text-[#0F3A63]">
              Enregistrer brouillon
            </button>
            <button onClick={submitToAssociates} className="rounded-md bg-[#76B82A] px-5 py-2 text-sm font-bold text-white">
              Soumettre aux associés
            </button>
          </div>
          {status ? <p className="mt-3 text-right text-xs font-bold text-[#76B82A]">{status}</p> : null}
        </article>
      </section>
    </section>
  );
}

export default MonautoevaluationRH;
