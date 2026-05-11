import { Bell } from "lucide-react";

const stats = [
  { title: "Taux promotion (2026)", value: "18%", subtitle: "vs 12% en 2025" },
  { title: "Score moyen cabinet", value: "3.7/5", subtitle: "+0.3 vs 2025" },
  { title: "Écarts signalés", value: "3", subtitle: "sur 24 évaluations" },
  { title: "Formations decidees", value: "4", subtitle: "dont 2 certifiantes" },
];

const scoreRows = [
  { initials: "DS", name: "Diallo S.", y2024: "3.2", y2025: "3.8", y2026: "3.9", trend: "↑ +0.7", trendClass: "text-[#78B843]" },
  { initials: "KA", name: "Kouame A.", y2024: "3.5", y2025: "4.2", y2026: "3.9", trend: "↑ +0.6", trendClass: "text-[#78B843]" },
  { initials: "YE", name: "Yao E.", y2024: "3.1", y2025: "3.0", y2026: "2.8", trend: "↓ -0.3", trendClass: "text-[#F24A4A]" },
  { initials: "GN", name: "Gbagbo N.", y2024: "3.8", y2025: "4.0", y2026: "4.2", trend: "↑ +0.4", trendClass: "text-[#78B843]" },
];

const historyRows = [
  { cycle: "Cycle 2026", name: "Diallo Seydou", decision: "Promotion → Manager Senior", className: "text-[#78B843]" },
  { cycle: "Cycle 2026", name: "Kone Awa", decision: "Augmentation +8%", className: "text-[#78B843]" },
  { cycle: "Cycle 2025", name: "Yao Emmanuel", decision: "Maintien + formation", className: "text-[#0F4A72]" },
  { cycle: "Cycle 2025", name: "Gnago Nadege", decision: "Promotion → Superviseur", className: "text-[#78B843]" },
];

const exportsRows = [
  { title: "Rapport consolidé cabinet", subtitle: "Synthèse complète - tous collaborateurs", type: "PDF" },
  { title: "Suivi des décisions RH", subtitle: "Historique promotions & augmentations", type: "XLSX" },
  { title: "Évolution des scores", subtitle: "Données brutes - cycles 2023-2026", type: "CSV" },
];

function Histoireanalytique() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">Historique & analytics</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => window.alert("Notifications bientôt disponibles.")} className="rounded-full p-2 text-slate-500 hover:bg-slate-200/70">
            <Bell size={15} />
          </button>
          <button onClick={() => window.print()} className="rounded-full bg-[#7DBA45] px-4 py-2 text-xs font-bold text-white hover:bg-[#71AB3D]">
            Exporter rapport
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <article key={item.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-3 text-xl font-extrabold">{item.value}</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{item.subtitle}</p>
          </article>
        ))}
      </section>

      <section>
        <p className="mb-2 text-sm font-bold text-[#78B843]">Évolution des scores - 3 cycles</p>
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="min-w-[920px] w-full border-collapse">
            <thead>
              <tr className="bg-[#0C4B6C] text-left text-sm font-semibold text-white">
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Cycle 2024</th>
                <th className="px-4 py-3">Cycle 2025</th>
                <th className="px-4 py-3">Cycle 2026</th>
                <th className="px-4 py-3">Tendance</th>
              </tr>
            </thead>
            <tbody>
              {scoreRows.map((row) => (
                <tr key={row.name} className="border-b border-slate-100 text-sm text-[#0F3A63] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                        {row.initials}
                      </span>
                      <p className="font-bold">{row.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold">{row.y2024}</td>
                  <td className="px-4 py-3 font-bold">{row.y2025}</td>
                  <td className={`px-4 py-3 font-bold ${row.y2026 === "2.8" ? "text-[#F24A4A]" : ""}`}>{row.y2026}</td>
                  <td className={`px-4 py-3 font-bold ${row.trendClass}`}>{row.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-2xl font-black text-[#0F3A63]">Historique des décisions RH prises</p>
            <p className="text-base font-bold text-[#0F4A72]">Cycle 2026 & anterieurs</p>
          </div>
          <div className="space-y-6 px-4 py-4">
            {historyRows.map((row) => (
              <div key={`${row.cycle}-${row.name}`} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-[#0F4A72]">{row.cycle}</p>
                  <p className="text-base font-black text-[#0F4A72]">{row.name}</p>
                </div>
                <p className={`text-base font-black ${row.className}`}>{row.decision}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-2xl font-black text-[#0F3A63]">Exports disponibles</p>
            <p className="text-base font-bold text-[#0F4A72]">Télécharger les données</p>
          </div>
          <div className="space-y-6 px-4 py-4">
            {exportsRows.map((row) => (
              <div key={row.title} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-black text-[#0F4A72]">{row.title}</p>
                  <p className="text-sm font-bold text-[#0F4A72]">{row.subtitle}</p>
                </div>
                <button
                  onClick={() => window.alert(`Export ${row.type} lance pour: ${row.title}`)}
                  className="inline-flex min-w-[74px] justify-center rounded-full bg-[#D8D8D8] px-3 py-1 text-xs font-bold text-[#0F4A72] hover:bg-[#cfcfcf]"
                >
                  {row.type}
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default Histoireanalytique;
