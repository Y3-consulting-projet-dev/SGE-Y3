import { calibrationRows } from "@/components/pages/rh/rhData";

function CalibrationRH() {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-extrabold text-[#0F3A63]">Calibration des scores</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">Comparaison des moyennes pour identifier les écarts de notation.</p>

      <div className="mt-5 space-y-4">
        {calibrationRows.map((row) => (
          <article key={row.department} className="rounded-lg bg-[#F8FAFC] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-extrabold text-[#0F3A63]">{row.department}</p>
                <p className="text-xs font-semibold text-slate-500">{row.evaluated} évaluations complètes</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-[#78B843]">{row.average}</p>
                <p className="text-xs font-bold text-slate-500">{row.risk}</p>
              </div>
            </div>
            <div className="h-3 rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-[#4E75C7]" style={{ width: row.width }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default CalibrationRH;
