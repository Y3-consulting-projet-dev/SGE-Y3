import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const initialSections = [
  {
    id: 1,
    title: "Section 1 - Leadership & management",
    status: "Complete",
    comment: "Equipe accompagnee sur les priorites du cycle.",
    criteria: [
      { label: "Animation d'équipe", score: 4 },
      { label: "Gestion des conflits", score: 3 },
      { label: "Developpement des talents", score: 4 },
    ],
  },
  {
    id: 2,
    title: "Section 2 - Pilotage & performance",
    status: "En cours",
    comment: "",
    criteria: [
      { label: "Respect des délais de livraison", score: null },
      { label: "Qualite des rapports produits", score: null },
      { label: "Gestion du portefeuille clients", score: null },
    ],
  },
  {
    id: 3,
    title: "Section 3 - Compétences techniques",
    status: "A faire",
    comment: "",
    criteria: [
      { label: "Maitrise des normes et procedures", score: null },
      { label: "Qualite des revues techniques", score: null },
      { label: "Resolution des points complexes", score: null },
    ],
  },
  {
    id: 4,
    title: "Section 4 - Developpement professionnel",
    status: "A faire",
    comment: "",
    criteria: [
      { label: "Progression sur les objectifs personnels", score: null },
      { label: "Contribution au partage de connaissances", score: null },
      { label: "Préparation aux responsabilités futures", score: null },
    ],
  },
];

function ScoreSelector({ selected, onSelect }) {
  return (
    <div className="space-y-2">
      <div className="flex overflow-hidden rounded-md border border-slate-200">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            onClick={() => onSelect(score)}
            className={`h-8 w-8 border-r border-slate-200 text-xs font-semibold last:border-r-0 ${
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

function SectionBadge({ status }) {
  if (status === "Complete") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#DFECD4] px-3 py-1 text-[11px] font-semibold text-[#79B742]">
        <CheckCircle2 size={12} />
        Complète
      </span>
    );
  }

  if (status === "En cours") {
    return <span className="rounded-full bg-[#F6D4D4] px-3 py-1 text-xs font-semibold text-[#DF4C4C]">En cours</span>;
  }

  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">  À faire</span>;
}

function Monautoevaluation() {
  const [sections, setSections] = useState(initialSections);
  const [activeSectionId, setActiveSectionId] = useState(2);
  const [saveStatus, setSaveStatus] = useState("");
  const [savedComments, setSavedComments] = useState({
    1: initialSections[0].comment,
  });

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[1];
  const completedSections = sections.filter((section) => section.status === "Complete").length;
  const progress = Math.round((completedSections / sections.length) * 100);

  const averageScore = useMemo(() => {
    const scores = activeSection.criteria.map((criterion) => criterion.score).filter(Boolean);
    if (!scores.length) return "--";
    return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
  }, [activeSection]);

  const updateCriterion = (criterionLabel, score) => {
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
    setSaveStatus("");
  };

  const updateComment = (comment) => {
    setSections((currentSections) =>
      currentSections.map((section) => (section.id === activeSectionId ? { ...section, comment, status: "En cours" } : section))
    );
    setSaveStatus("");
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
    setSaveStatus(isComplete ? "complete" : "partial");
  };

  const goToNextSection = () => {
    const nextSection = sections.find((section) => section.id > activeSectionId);
    if (nextSection) {
      setActiveSectionId(nextSection.id);
      setSaveStatus("");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-400">Axelle Amani - Manager - Cycle 2025-2026</p>

      <div className="rounded-sm bg-[#DCECCB] px-4 py-3 text-xs font-semibold text-[#1E5B34]">
        Cette auto-évaluation sera transmise à l'Associé après validation RH. Soyez précis et factuel.
      </div>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-[#0F3A63]">
            Progression - {completedSections} / {sections.length} sections
          </p>
          <span className="text-xs font-semibold text-[#E53935]">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-300">
          <div className="h-2 rounded-full bg-[#2AA7D6]" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-5">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSectionId(section.id);
                setSaveStatus("");
              }}
              className={`w-full rounded-md bg-white p-4 text-left shadow-sm transition ${
                activeSectionId === section.id ? "ring-2 ring-[#79B742]" : "hover:bg-slate-50"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-sm font-bold text-[#79B742]">{section.title}</h2>
                <SectionBadge status={section.status} />
              </div>

              <div className="space-y-2">
                {section.criteria.map((criterion) => (
                  <div key={criterion.label} className="flex items-center justify-between text-xs font-semibold text-[#0F3A63]">
                    <p>{criterion.label}</p>
                    <span className={criterion.score ? "text-[#79B742]" : "text-slate-400"}>
                      {criterion.score ? `${criterion.score}/5` : "--"}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-3 xl:col-span-7">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F3A63]">{activeSection.title}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">Score moyen : {averageScore} / 5</p>
              </div>
              <SectionBadge status={activeSection.status} />
            </div>

            <div className="space-y-4">
              {activeSection.criteria.map((criterion) => (
                <div key={criterion.label} className="space-y-2">
                  <p className="text-xs font-semibold text-[#0F3A63]">{criterion.label}</p>
                  <ScoreSelector selected={criterion.score} onSelect={(score) => updateCriterion(criterion.label, score)} />
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-[#79B742]">Commentaire de section</p>
              <textarea
                rows={3}
                value={activeSection.comment}
                onChange={(event) => updateComment(event.target.value)}
                placeholder="Exemples concrets, points forts, axes d'amelioration..."
                className="w-full resize-none rounded-md border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
              />
            </div>

            {savedComments[activeSectionId] ? (
              <div className="mt-3 rounded-md bg-[#DCECCB] px-3 py-3">
                <p className="mb-1 text-xs font-bold text-[#79B742]">Commentaire Sauvegarder</p>
                <p className="text-sm font-semibold text-[#0F3A63]">{savedComments[activeSectionId]}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={goToNextSection}
                disabled={activeSectionId === sections.length}
                className="rounded-md bg-[#003B63] px-6 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Section suivante
              </button>
              <button onClick={saveSection} className="rounded-md bg-[#79B742] px-8 py-2 text-xs font-semibold text-white">
                Sauvegarder
              </button>
              {saveStatus ? (
                <p className="w-full text-right text-xs font-bold text-[#79B742]">
                  {saveStatus === "complete" ? "Section complete sauvegardee." : "Section sauvegardee, notes restantes a completer."}
                </p>
              ) : null}
            </div>
          </article>

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
                  Aucun commentaire Sauvegarder pour le moment.
                </p>
              )}
            </div>

            <h3 className="mb-3 text-xs font-semibold text-[#79B742]">Circuit de validation</h3>
            <div className="space-y-3 text-xs font-semibold text-[#0F3A63]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DFECD4] text-[#79B742]">
                  OK
                </span>
                <p>Vous saisissez votre auto-évaluation</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2AA7D6] text-white">
                  1
                </span>
                <div>
                  <p>Soumission à la RH (vous)</p>
                  <p className="text-[11px] text-slate-400">Apres completion des 4 sections</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  3
                </span>
                <p>Validation RH - Isabella Beda</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default Monautoevaluation;
