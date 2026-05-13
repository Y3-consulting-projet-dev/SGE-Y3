import { syntheseRows } from "@/components/pages/rh/rhData";

function SynthesesRH({ readOnly = false }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Syntheses RH</h2>
          <p className="text-sm font-semibold text-slate-500">Dossiers consolidés et prêts à être transmis.</p>
        </div>
        <button
          disabled={readOnly}
          className={`rounded-full px-4 py-2 text-xs font-bold ${
            readOnly ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-[#0D496A] text-white"
          }`}
        >
          {readOnly ? "Lecture seule" : "Transmettre à l'Associé"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {syntheseRows.map((row) => (
          <article key={row.collaborator} className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-4">
            <p className="text-xs font-bold uppercase text-slate-400">{row.role}</p>
            <h3 className="mt-1 text-lg font-extrabold text-[#0F3A63]">{row.collaborator}</h3>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Recommandation</p>
                <p className="mt-1 text-sm font-bold text-[#0F4A72]">{row.recommendation}</p>
              </div>
              <p className="text-2xl font-black text-[#78B843]">{row.score}</p>
            </div>
            <p className="mt-4 rounded-md bg-white px-3 py-2 text-xs font-bold text-slate-500">Décision: {row.decisionOwner}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default SynthesesRH;
