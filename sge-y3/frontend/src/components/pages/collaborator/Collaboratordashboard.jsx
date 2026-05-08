import { CheckCircle2 } from "lucide-react";

const reminders = [
  { label: "Soumettre l'auto-évaluation", date: "18-04-2026" },
  { label: "Entretien annuel Manager", date: "22-04-2026" },
  { label: "Revue objectifs Q2", date: "30-04-2026" },
];

function formatProgressSubtitle(evaluation) {
  const completed = evaluation?.summary?.completedSections || 0;
  const total = evaluation?.summary?.totalSections || 4;
  const progress = evaluation?.summary?.globalProgress || 0;

  return `Section ${Math.min(completed + 1, total)} / ${total} - ${progress}%`;
}

function getSectionStepTitle(section) {
  const status = section.status === "Complete" ? "completée" : section.status === "En cours" ? "en cours" : "à faire";
  return `${section.title} ${status}`;
}

function getEvaluationStatusLabel(status) {
  if (status === "Soumis a RH") return "Soumise à la RH";
  if (status === "Brouillon") return "Brouillon";
  return "En cours";
}

function MonTableauDeBord({ evaluation, onContinue, isLoading }) {
  const topCards = [
    {
      title: "Auto-évaluation",
      line1: getEvaluationStatusLabel(evaluation?.evaluation?.status),
      line2: formatProgressSubtitle(evaluation),
    },
    { title: "Mes objectifs", line1: "3", line2: "1 atteint, 2 en cours" },
    { title: "Formation planifiée", line1: "--", line2: "Mai 2026" },
  ];

  const progressSteps =
    evaluation?.evaluation?.sections?.map((section) => ({
      id: section.id,
      title: getSectionStepTitle(section),
      subtitle: section.subtitle,
      done: section.status === "Complete",
    })) || [];

  const globalProgress = evaluation?.summary?.globalProgress || 0;
  const completedSections = evaluation?.summary?.completedSections || 0;

  return (
    <div className="space-y-4">
      <div className="rounded-sm bg-[#BFE2B9] px-3 py-2 text-[11px] font-semibold text-[#114F35]">
        {evaluation?.evaluation?.status === "Soumis a RH"
          ? "Auto-évaluation soumise à la RH. En attente de traitement."
          : "Auto-évaluation en cours -  à soumettre avant le 18/04/2026. Sauvegarde automatique activée"}
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(3,minmax(0,240px))] md:justify-between md:gap-5">
        {topCards.map((card) => (
          <article key={card.title} className="rounded-md bg-[#003B63] px-3.5 py-3 text-white">
            <h2 className="mb-2 text-[12px] font-semibold">{card.title}</h2>
            <p className="text-[13px] font-medium text-slate-100">{card.line1}</p>
            <p className="mt-1.5 text-[12px] font-medium text-slate-200">{card.line2}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.8fr_1fr]">
        <article className="rounded-lg bg-white p-5 xl:col-span-1">
          <h2 className="mb-4 text-[24px] font-bold leading-tight text-[#0F3A63]">Où en suis-je ?</h2>

          <div className="space-y-3">
            {progressSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <div
                  className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    step.done ? "bg-[#DFF0D8] text-[#2F7D32]" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {step.done ? <CheckCircle2 size={12} /> : step.id}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#0F3A63]">{step.title}</p>
                  <p className="text-[10px] text-slate-500">{step.subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[22px] font-bold leading-tight text-[#0F3A63]">Progression globale</h3>
              <span className="text-[22px] font-bold text-[#F34D4D]">{globalProgress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200">
              <div className="h-2.5 rounded-full bg-[#2FB6D9]" style={{ width: `${globalProgress}%` }} />
            </div>
          </div>

          <button
            onClick={onContinue}
            disabled={isLoading}
            className="mt-5 w-full rounded-md bg-[#003B63] py-3 text-[22px] font-semibold leading-none text-white hover:bg-[#0B4C7A] disabled:opacity-60"
          >
            Continuer l'évaluation
          </button>
        </article>

        <div className="space-y-4">
          <article className="rounded-lg bg-white p-5">
            <h2 className="mb-4 text-[24px] font-bold leading-tight text-[#0F3A63]">Circuit de validation</h2>
            <div className="space-y-3">
              {[
                { id: 1, title: "Je soumets mon auto-évaluation", subtitle: evaluation?.evaluation?.status === "Soumis a RH" ? "Deja transmise" : "En attente de ma soumission" },
                { id: 2, title: "Mon Manager évalue & corrige", subtitle: "Droit feedback" },
                { id: 3, title: "Validation RH / Capital Humain", subtitle: "Validation métier" },
                { id: 4, title: "Decision de l'Associé", subtitle: "Résultat communiqué ensuite" },
              ].map((step) => (
                <div key={step.id} className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
                    {step.id}
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold text-[#0F3A63]">{step.title}</p>
                    <p className="text-[10px] text-slate-500">{step.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg bg-white p-5">
            <h2 className="mb-4 text-[24px] font-bold leading-tight text-[#0F3A63]">Rappels & échéances</h2>
            <div className="space-y-3">
              {reminders.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-[12px]">
                  <p className="font-semibold text-[#0F3A63]">{item.label}</p>
                  <span className="font-bold text-[#F34D4D]">{item.date}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] font-semibold text-[#0F3A63]">
              {completedSections} section(s) completée(s) sur {evaluation?.summary?.totalSections || 4}.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default MonTableauDeBord;
