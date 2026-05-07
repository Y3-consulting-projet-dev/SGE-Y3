import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

const initialSections = [
  {
    id: 1,
    title: "Section 1",
    subtitle: "Savoir-etre",
    status: "Complete",
    comment: "Je communique regulierement avec l'equipe et je respecte les delais fixes.",
    criteria: [
      { label: "Ponctualite & fiabilite", score: 4 },
      { label: "Travail en equipe", score: 4 },
      { label: "Communication", score: 3 },
      { label: "Adaptabilite", score: 4 },
    ],
  },
  {
    id: 2,
    title: "Section 2",
    subtitle: "Competences tech.",
    status: "En cours",
    comment: "",
    criteria: [
      { label: "Maitrise des outils comptables (CEGID, Sage)", score: null },
      { label: "Redaction des rapports d'audit", score: null },
      { label: "Analyse et interpretation des donnees financieres", score: null },
    ],
  },
  {
    id: 3,
    title: "Section 3",
    subtitle: "Objectifs atteints",
    status: "A faire",
    comment: "",
    criteria: [
      { label: "Respect des objectifs fixes en debut de cycle", score: null },
      { label: "Contribution aux livrables de mission", score: null },
      { label: "Qualite des resultats obtenus", score: null },
    ],
  },
  {
    id: 4,
    title: "Section 4",
    subtitle: "Evolution souhaitee",
    status: "A faire",
    comment: "",
    criteria: [
      { label: "Competences a developper", score: null },
      { label: "Projection professionnelle", score: null },
      { label: "Besoins de formation", score: null },
    ],
  },
];

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - a ameliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - depasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excellent - reference dans l'equipe", color: "text-[#76B82A]" },
];

function getSectionProgress(section) {
  const answered = section.criteria.filter((criterion) => criterion.score).length;
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

function Monautoevaluation() {
  const [sections, setSections] = useState(initialSections);
  const [activeSectionId, setActiveSectionId] = useState(2);
  const [saved, setSaved] = useState(false);
  const [savedComments, setSavedComments] = useState({ 1: initialSections[0].comment });

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[1];
  const completedSections = sections.filter((section) => section.status === "Complete").length;
  const globalProgress = Math.round((sections.reduce((total, section) => total + getSectionProgress(section), 0) / sections.length));
  const averageScore = useMemo(() => {
    const scores = activeSection.criteria.map((criterion) => criterion.score).filter(Boolean);
    if (!scores.length) return "--";
    return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
  }, [activeSection]);

  const updateScore = (criterionLabel, score) => {
    setSections((currentSections) =>
      currentSections.map((section) => {
        if (section.id !== activeSectionId) return section;
        return {
          ...section,
          status: "En cours",
          criteria: section.criteria.map((criterion) =>
            criterion.label === criterionLabel ? { ...criterion, score } : criterion
          ),
        };
      })
    );
    setSaved(false);
  };

  const updateComment = (comment) => {
    setSections((currentSections) =>
      currentSections.map((section) => (section.id === activeSectionId ? { ...section, comment, status: "En cours" } : section))
    );
    setSaved(false);
  };

  const saveSection = () => {
    const isComplete = activeSection.criteria.every((criterion) => criterion.score);
    const trimmedComment = activeSection.comment.trim();

    setSections((currentSections) =>
      currentSections.map((section) =>
        section.id === activeSectionId ? { ...section, status: isComplete ? "Complete" : "En cours" } : section
      )
    );

    if (trimmedComment) {
      setSavedComments((comments) => ({ ...comments, [activeSectionId]: trimmedComment }));
    }
    setSaved(true);
  };

  const goToSection = (direction) => {
    const nextId = activeSectionId + direction;
    if (nextId >= 1 && nextId <= sections.length) {
      setActiveSectionId(nextId);
      setSaved(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-slate-500">Cycle 2025 - Formulaire en cours - Sauvegarde auto activee</div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <p className="font-semibold text-[#0F3A63]">Derniere sauvegarde automatique : il y a 2 min</p>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#0F3A63]">Section {activeSectionId} / 4</span>
          <button onClick={saveSection} className="font-semibold text-[#76B82A] hover:underline">Sauvegarder maintenant</button>
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
                setActiveSectionId(section.id);
                setSaved(false);
              }}
              className={`rounded-md bg-[#003B63] px-3 py-2 text-left text-white transition ${
                activeSectionId === section.id ? "ring-2 ring-[#76B82A]" : "hover:bg-[#0B4C7A]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-bold">{section.title}</h2>
                {done ? <Check size={14} className="text-white" /> : null}
              </div>
              <p className="text-[12px] font-semibold">{section.subtitle}</p>
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
                {activeSection.title} - {activeSection.subtitle}
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
              <p className="text-[10px] font-bold text-[#5A8A3A]">Commentaire sauvegarde</p>
              <p className="mt-1 text-[11px] font-semibold text-[#0F3A63]">{savedComments[activeSectionId]}</p>
            </div>
          ) : null}

          <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
            Les questions obligatoires (sans reponse) bloqueront la soumission. Les questions avec etoile * sont requises.
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => goToSection(-1)}
              disabled={activeSectionId === 1}
              className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={14} />
              Section precedente
            </button>
            <button
              onClick={() => {
                saveSection();
                goToSection(1);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
            >
              Sauvegarder et continuer
              <ChevronRight size={14} />
            </button>
          </div>
          {saved ? <p className="mt-2 text-right text-[11px] font-semibold text-[#76B82A]">Sauvegarde reussie.</p> : null}
        </article>

        <div className="space-y-4">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[22px] font-bold text-[#0F3A63]">Progression globale</h3>
              <span className="text-[13px] font-bold text-[#76B82A]">{globalProgress}%</span>
            </div>
            <p className="mb-4 text-[12px] font-semibold text-[#76B82A]">{completedSections} section(s) complete(s)</p>

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
            <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Aide a la notation</h3>
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
