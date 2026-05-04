const reportCards = [
  { title: "Score moyen equipe", value: "3.7", subtitle: "Sur 5", accent: "" },
  { title: "Taux completion", value: "80%", subtitle: "4/5 evalo soumises", accent: "" },
  { title: "Ecarts signales", value: "1", subtitle: "A justifier", accent: "text-[#F34D4D]" },
  { title: "Promos recommandees", value: "2", subtitle: "", accent: "" },
];

const collaboratorScores = [
  {
    initials: "kk",
    name: "Kader kone",
    technique: "4/5",
    behavior: "2/5",
    goals: "4/5",
    finalScore: "3.2/5",
    recommendation: "Promotion",
    recommendationClass: "bg-[#E3E7F3] text-[#4F67C7]",
  },
  {
    initials: "Ok",
    name: "Orlane Kone",
    technique: "3/5",
    behavior: "3/5",
    goals: "3/5",
    finalScore: "3/5",
    recommendation: "Maintien",
    recommendationClass: "bg-[#F5DFC2] text-[#D48A2A]",
  },
  {
    initials: "YK",
    name: "Yasimin K",
    technique: "4/5",
    behavior: "5/5",
    goals: "5/5",
    finalScore: "4.6/5",
    recommendation: "Augmentation",
    recommendationClass: "bg-[#DFECD4] text-[#73AF2E]",
  },
  {
    initials: "LY",
    name: "Louise Yao",
    technique: "4/5",
    behavior: "5/5",
    goals: "4/5",
    finalScore: "4.2/5",
    recommendation: "Augmentation",
    recommendationClass: "bg-[#DFECD4] text-[#73AF2E]",
  },
];

const exportsList = [
  {
    title: "Rapport synthese equipe",
    subtitle: "Scores, recommandations, objectifs - PDF",
    action: "Export PDF",
    actionClass: "bg-[#1E88F4] text-white",
  },
  {
    title: "Donnees detaillees equipe",
    subtitle: "Toutes les notes et reponses - Excel",
    action: "Export Excel",
    actionClass: "bg-[#EAF1F8] text-[#0F3A63]",
  },
  {
    title: "Suivi objectifs SMART",
    subtitle: "Progression par collaborateur - PDF",
    action: "Export PDF",
    actionClass: "bg-[#EAF1F8] text-[#0F3A63]",
  },
];

function Rapportsequipe() {
  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold text-slate-400">Reporting - Cycle 2026</p>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((card) => (
          <article key={card.title} className="rounded-lg bg-[#003B63] p-4 text-white shadow-sm">
            <p className="mb-5 text-xs font-semibold">{card.title}</p>
            <p className={`text-xl font-extrabold ${card.accent}`}>{card.value}</p>
            {card.subtitle ? <p className="mt-2 text-xs text-[#D8E6F0]">{card.subtitle}</p> : null}
          </article>
        ))}
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-2xl font-extrabold text-[#0F3A63]">Synthese des scores par collaborateur</h2>
        <div className="overflow-x-auto rounded-md border border-slate-100">
          <table className="min-w-[860px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#003B63] text-left text-white">
                <th className="px-4 py-3 font-semibold">Collaborateur</th>
                <th className="px-4 py-3 font-semibold">Technique</th>
                <th className="px-4 py-3 font-semibold">Savoir-etre</th>
                <th className="px-4 py-3 font-semibold">Objectifs</th>
                <th className="px-4 py-3 font-semibold">Score final</th>
                <th className="px-4 py-3 font-semibold">Recommandation</th>
              </tr>
            </thead>
            <tbody>
              {collaboratorScores.map((row) => (
                <tr key={row.name} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-500">
                        {row.initials}
                      </span>
                      <span className="font-semibold">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#73AF2E]">{row.technique}</td>
                  <td className={`px-4 py-3 font-semibold ${row.behavior === "2/5" ? "text-[#F34D4D]" : "text-[#73AF2E]"}`}>
                    {row.behavior}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${row.goals === "3/5" ? "text-[#D48A2A]" : "text-[#73AF2E]"}`}>
                    {row.goals}
                  </td>
                  <td className="px-4 py-3 font-bold">{row.finalScore}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex min-w-[116px] justify-center rounded-full px-3 py-1 text-xs font-semibold ${row.recommendationClass}`}>
                      {row.recommendation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold text-[#0F3A63]">Exports disponibles</h2>
        <div className="space-y-2">
          {exportsList.map((item) => (
            <article key={item.title} className="rounded-md bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-3xl font-extrabold text-[#79B742]">{item.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F3A63]">{item.subtitle}</p>
                </div>
                <button className={`rounded-md px-5 py-2 text-xs font-semibold ${item.actionClass}`}>{item.action}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Rapportsequipe;
