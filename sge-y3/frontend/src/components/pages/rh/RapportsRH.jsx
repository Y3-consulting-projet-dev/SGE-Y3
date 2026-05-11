import { reportRows } from "@/components/pages/rh/rhData";

function RapportsRH() {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Rapports RH</h2>
          <p className="text-sm font-semibold text-slate-500">Exports et documents du cycle d'évaluation.</p>
        </div>
        <button className="rounded-full bg-[#8BC53F] px-4 py-2 text-xs font-bold text-white">Generer export</button>
      </div>

      <div className="space-y-3">
        {reportRows.map((row) => (
          <article key={row.title} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] p-4">
            <div>
              <p className="text-sm font-extrabold text-[#0F3A63]">{row.title}</p>
              <p className="text-xs font-semibold text-slate-500">Proprietaire: {row.owner}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">{row.format}</span>
              <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-bold text-slate-600">{row.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default RapportsRH;
