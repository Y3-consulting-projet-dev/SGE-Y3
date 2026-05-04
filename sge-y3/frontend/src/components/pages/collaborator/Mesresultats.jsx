import { useState } from "react";

const topCards = [
  { title: "Score final", value: "3.6/5", subtitle: "Calcule automatiquement" },
  { title: "Decision RH", value: "Maintien", subtitle: "avec plan de formation" },
  { title: "Comparaison equipe", value: "+0.1", subtitle: "Au-dessus de la moyenne" },
];

const sectionScores = [
  { label: "Savoir-etre", score: 3.8, percent: 78 },
  { label: "Competences techniques", score: 3.3, percent: 66 },
  { label: "Objectifs atteints", score: 3.5, percent: 70 },
];

function Mesresultats() {
  const [reportDownloaded, setReportDownloaded] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-semibold text-slate-500">Cycle 2026 - Resultats disponibles</p>

      <div className="rounded-sm bg-[#BFE2B9] px-4 py-3 text-[12px] font-semibold text-[#114F35]">
        Evaluation cloturee le 02/05/2026. La decision de l'Associe a ete communiquee.
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {topCards.map((card) => (
          <article key={card.title} className="rounded-md bg-[#003B63] px-4 py-3 text-white">
            <h2 className="mb-4 text-[12px] font-bold">{card.title}</h2>
            <p className="text-[18px] font-bold text-[#7BC443]">{card.value}</p>
            <p className="mt-3 text-[12px] font-semibold text-slate-200">{card.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.05fr]">
        <div className="space-y-4">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-[14px] font-bold text-[#0F3A63]">Detail des scores par section</h3>
            <div className="space-y-4">
              {sectionScores.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-[13px] font-semibold text-[#0F3A63]">
                    <p>{item.label}</p>
                    <span>{item.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-300">
                    <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
              <div>
                <div className="mb-1 flex items-center justify-between text-[13px] font-bold text-[#0F3A63]">
                  <p>Score final pondere</p>
                  <span className="text-[#76B82A]">3.6 / 5</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-300">
                  <div className="h-1.5 w-[72%] rounded-full bg-[#76B82A]" />
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[22px] font-bold leading-tight text-[#0F3A63]">Commentaire du Manager</h3>
            <div className="rounded-md bg-slate-100 p-4">
              <p className="text-[12px] text-slate-600">
                "Mamadou fait preuve d'une bonne rigueur sur les dossiers. Des progres attendus sur la rapidite de
                rendu des rapports. Formation recommandee sur CEGID avance."
              </p>
              <p className="mt-8 text-[12px] font-semibold text-[#0F3A63]">Diallo Seydou - Manager - 28/04/2026</p>
            </div>
          </article>
        </div>

        <div className="space-y-4">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[24px] font-bold leading-tight text-[#0F3A63]">Decision RH</h3>
              <span className="rounded-md bg-[#DCECCB] px-2 py-0.5 text-[11px] font-bold text-[#76B82A]">Cloture</span>
            </div>

            <div className="rounded-md bg-slate-100 p-3">
              <p className="text-[18px] font-bold text-[#0F3A63]">Maintien de poste</p>
              <p className="mt-1 text-[12px] font-semibold text-[#76B82A]">avec formation CEGID avance planifiee</p>
            </div>

            <div className="mt-3 rounded-sm border-l-4 border-[#76B82A] bg-[#EAF5DF] px-3 py-2">
              <p className="text-[12px] font-bold text-[#0F3A63]">Commentaire de l'Associe</p>
              <p className="mt-1 text-[10px] text-slate-500">
                "Bon potentiel. Une etape supplementaire pour confirmer la maitrise technique avant toute evolution."
              </p>
            </div>
            <p className="mt-2 text-right text-[11px] font-semibold text-slate-400">Decision prise le 05/05/2026</p>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-[20px] font-bold text-[#0F3A63]">Evolution sur 2 cycles</h3>
            <div className="space-y-3 text-[13px] font-semibold">
              <div className="flex items-center justify-between text-[#0F3A63]">
                <p>Cycle 2025</p>
                <p>3.2 / 5 - Maintien</p>
              </div>
              <div className="flex items-center justify-between text-[#76B82A]">
                <p>Cycle 2026</p>
                <p>3.6 / 5 - Maintien</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-bold text-[#76B82A]">Progression de +0.4 point en 1 an</p>
          </article>

          <button
            onClick={() => {
              setReportDownloaded(true);
              window.print();
            }}
            className="mx-auto block rounded-md bg-[#76B82A] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#6EAD28]"
          >
            Telecharger mon rapport pdf
          </button>
          {reportDownloaded ? (
            <p className="text-center text-[11px] font-semibold text-[#76B82A]">Rapport lance pour impression.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default Mesresultats;
