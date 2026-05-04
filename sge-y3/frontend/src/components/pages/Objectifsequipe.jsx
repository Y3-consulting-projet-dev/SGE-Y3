import { Target, TrendingDown, Users } from "lucide-react";

const objectives = [
  {
    title: "Certification DSCG",
    collaborator: "Amelie K",
    deadline: "30/06",
    progress: 65,
    status: "En bonne voie",
    statusClass: "bg-[#DFECD4] text-[#5E8F2A]",
    barClass: "bg-[#5C75C9]",
  },
  {
    title: "Reduire delais rapports a 48h",
    collaborator: "Orlane K.",
    deadline: "30/04",
    progress: 40,
    status: "A surveiller",
    statusClass: "bg-[#F5D5AF] text-[#B56A00]",
    barClass: "bg-[#4A3EF0]",
  },
  {
    title: "Encadrer 2 juniors",
    collaborator: "Kader K",
    deadline: "31/05",
    progress: 100,
    status: "Atteint",
    statusClass: "bg-[#DFECD4] text-[#5E8F2A]",
    barClass: "bg-[#79B742]",
  },
];

function StatCard({ title, value, subtitle, icon }) {
  return (
    <article className="rounded-lg bg-[#003B63] p-4 text-white shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <p className="text-xs font-semibold">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="mt-2 text-xs text-[#D8E6F0]">{subtitle}</p>
    </article>
  );
}

function Objectifsequipe() {
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="Objectifs actifs"
          value="12"
          subtitle="8 equipe complete"
          icon={<Users size={18} className="text-[#DCEAF5]" />}
        />
        <StatCard
          title="Taux d'atteinte moyen"
          value="61%"
          subtitle="-5% vs trimestre precedent"
          icon={<TrendingDown size={18} className="text-[#F15C5C]" />}
        />
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#0F3A63]">Objectifs par collaborateur</h2>
          <div className="flex items-center gap-2">
            <button className="rounded-md bg-[#8BC53F] px-4 py-2 text-xs font-semibold text-white">
              Tous les membres
            </button>
            <button className="rounded-md bg-[#8BC53F] px-4 py-2 text-xs font-semibold text-white">
              Tous les statuts
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-100">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#003B63] text-left text-white">
                <th className="px-4 py-3 font-semibold">Objectif</th>
                <th className="px-4 py-3 font-semibold">Collaborateur</th>
                <th className="px-4 py-3 font-semibold">Echeance</th>
                <th className="px-4 py-3 font-semibold">Progression</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((item) => (
                <tr key={item.title} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                  <td className="px-4 py-4 font-semibold">{item.title}</td>
                  <td className="px-4 py-4">{item.collaborator}</td>
                  <td className="px-4 py-4">{item.deadline}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-full max-w-[140px] rounded-full bg-slate-200">
                        <div className={`h-2 rounded-full ${item.barClass}`} style={{ width: `${item.progress}%` }} />
                      </div>
                      <span className="min-w-10 text-xs font-semibold">{item.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-lg px-3 py-1 text-xs font-semibold ${item.statusClass}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-[#0F3A63]">Creer un objectif SMART</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Collaborateur</span>
            <div className="flex h-11 items-center justify-between rounded-md bg-slate-100 px-3 text-sm text-slate-400">
              <span>Orlane K</span>
              <span>v</span>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Indicateur de reussite</span>
            <input
              type="text"
              placeholder="EX: examen passe et valide"
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Intitule de l'objectif</span>
            <input
              type="text"
              placeholder="EX: Certification DSCG avant juin 2026"
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-[#0F3A63]">Date cible</span>
            <input
              type="text"
              placeholder="JJ/MM/AAAA"
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button className="inline-flex items-center gap-2 rounded-full bg-[#8BC53F] px-5 py-2 text-sm font-semibold text-white">
            <Target size={16} />
            Enregistrer l'objectif
          </button>
        </div>
      </section>
    </div>
  );
}

export default Objectifsequipe;
