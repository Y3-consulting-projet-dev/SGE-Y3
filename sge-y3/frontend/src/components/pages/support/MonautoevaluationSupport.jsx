import { useMemo, useState } from "react";

const supportSections = [
  {
    id: "service",
    title: "Qualite de service",
    criteria: ["Reactivite aux demandes internes", "Fiabilite du suivi des tickets", "Clarte de la communication"],
  },
  {
    id: "organisation",
    title: "Organisation et priorites",
    criteria: ["Respect des delais", "Gestion des urgences", "Coordination avec les equipes metiers"],
  },
  {
    id: "amelioration",
    title: "Amelioration continue",
    criteria: ["Proposition de solutions", "Documentation des procedures", "Contribution a la performance du cabinet"],
  },
];

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
  const [answers, setAnswers] = useState({});
  const [comments, setComments] = useState({});
  const [status, setStatus] = useState("");

  const allCriteria = supportSections.flatMap((section) => section.criteria.map((criterion) => `${section.id}-${criterion}`));
  const completed = allCriteria.filter((key) => answers[key]).length;
  const progress = Math.round((completed / allCriteria.length) * 100);
  const average = useMemo(() => {
    const scores = Object.values(answers).filter(Boolean);
    if (!scores.length) return "--";
    return (scores.reduce((total, score) => total + Number(score), 0) / scores.length).toFixed(1);
  }, [answers]);

  const submitToAssociates = () => {
    setStatus("Auto-evaluation support soumise directement aux associes.");
  };

  return (
    <section className="space-y-5">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase text-slate-400">Departement support</p>
        <h2 className="mt-1 text-2xl font-black text-[#0F3A63]">Mon auto-evaluation</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {user?.first_name} {user?.last_name} - Soumission directe aux associes.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-xs font-bold">Progression</p>
            <p className="mt-2 text-2xl font-black text-[#86EFAC]">{progress}%</p>
          </div>
          <div className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-xs font-bold">Score moyen</p>
            <p className="mt-2 text-2xl font-black text-[#86EFAC]">{average}/5</p>
          </div>
        </div>
      </article>

      {supportSections.map((section) => (
        <article key={section.id} className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-lg font-extrabold text-[#0F3A63]">{section.title}</h3>
          <div className="mt-4 space-y-4">
            {section.criteria.map((criterion) => {
              const key = `${section.id}-${criterion}`;
              return (
                <div key={criterion} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
                  <p className="text-sm font-semibold text-[#0F3A63]">{criterion}</p>
                  <ScoreButtons value={answers[key]} onChange={(score) => setAnswers((current) => ({ ...current, [key]: score }))} />
                </div>
              );
            })}
          </div>
          <textarea
            value={comments[section.id] || ""}
            onChange={(event) => setComments((current) => ({ ...current, [section.id]: event.target.value }))}
            placeholder="Commentaire support..."
            className="mt-4 min-h-[90px] w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-[#0F3A63] outline-none"
          />
        </article>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {status ? <p className="text-sm font-bold text-[#4E8B1B]">{status}</p> : null}
        <button onClick={submitToAssociates} className="rounded-full bg-[#0F3A63] px-6 py-3 text-sm font-extrabold text-white">
          Soumettre aux associes
        </button>
      </div>
    </section>
  );
}

export default MonautoevaluationSupport;
