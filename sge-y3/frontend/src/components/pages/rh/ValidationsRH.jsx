import { validationRows } from "@/components/pages/rh/rhData";

function statusClass(status) {
  if (status === "Prêt Associé") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "Écart à arbitrer") return "bg-[#F9DFDF] text-[#B63232]";
  if (status === "À compléter") return "bg-[#FFF2CC] text-[#8A6810]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function ValidationsRH() {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Dossiers à valider</h2>
          <p className="text-sm font-semibold text-slate-500">Contrôle RH avant transmission ou décision finale.</p>
        </div>
        <button className="rounded-full bg-[#8BC53F] px-4 py-2 text-xs font-bold text-white">Valider la sélection</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[#F3F6F8] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Collaborateur</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Action RH</th>
            </tr>
          </thead>
          <tbody>
            {validationRows.map((row) => (
              <tr key={row.name} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                <td className="px-4 py-4">
                  <p className="font-bold">{row.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{row.role}</p>
                </td>
                <td className="px-4 py-4 font-semibold">{row.manager}</td>
                <td className="px-4 py-4 font-black text-[#78B843]">{row.score}/5</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.status)}`}>{row.status}</span>
                </td>
                <td className="px-4 py-4 text-xs font-semibold text-slate-600">{row.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ValidationsRH;
