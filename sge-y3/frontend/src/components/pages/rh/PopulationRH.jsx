import { useMemo, useState } from "react";
import { populationRows } from "@/components/pages/rh/rhData";

const teamDetails = {
  Managers: [
    { name: "Revita Oule", role: "Manager audit", status: "Validé RH", score: "4.1" },
    { name: "Axelle Amani", role: "Manager audit", status: "Validé RH", score: "4.0" },
    { name: "Nadia Kouassi", role: "Manager expertise comptable", status: "Validé RH", score: "3.9" },
    { name: "Ismael Bamba", role: "Manager conseil financier", status: "Validé RH", score: "3.5" },
  ],
  Seniors: [
    { name: "Yasmine Kouadio", role: "Senior Expertise comptable", status: "Validé RH", score: "3.9" },
    { name: "Elisé", role: "Senior audit", status: "Validé RH", score: "3.8" },
    { name: "Roxane N'guoran", role: "Assitante manager", status: "Validé RH", score: "3.0" },
    { name: "Lamine Touré", role: "Assistant Expertise comptable ", status: "Validé RH", score: "3.4" },
    { name: "Fatoumata Ouattara", role: "Assistante RH", status: "Validé RH", score: "4.1" },
    { name: "Bintou Onguoiba", role: "Consultante opérationnel", status: "À compléter", score: "-" },
  ],
  Collaborateurs: [
    { name: "Amelie Kouadio", role: "Collaboratrice Expertise comptable ", status: "À valider RH", score: "3.8" },
    { name: "Louise Yao", role: "Collaboratrice audit", status: "Prêt Associé", score: "4.0" },
    { name: "Orlane Kone", role: "Assistante Expertise comptable", status: "Validé RH", score: "3.6" },
    { name: "Kader Kone", role: "Assistant expertise comptable", status: "À compléter", score: "2.9" },
    { name: "Habib Bah", role: "Assistant expertise comptable", status: "Sous revue RH", score: "3.0" },
    { name: "Charlotte Coulibaly", role: "Conseil finacier", status: "Validé RH", score: "3.0" },
  ],
  Assistants: [
    { name: "Habib Bah", role: "Assistant Expertise comptable", status: "Écart à arbitrer", score: "3.2" },
    { name: "Yves Audit", role: "Assistant audit", status: "Validé RH", score: "3.9" },
    { name: "Kader Kone", role: "Assistant expertise comptable", status: "À compléter", score: "2.9" },
  ],
};

function statusClass(status) {
  if (status === "Validé RH" || status === "Prêt Associé") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "À compléter") return "bg-[#FFF2CC] text-[#8A6810]";
  if (status === "Écart à arbitrer" || status === "Sous revue RH") return "bg-[#F9DFDF] text-[#B63232]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function PopulationRH() {
  const [selectedGroup, setSelectedGroup] = useState(populationRows[0].group);

  const selectedRow = useMemo(
    () => populationRows.find((row) => row.group === selectedGroup) || populationRows[0],
    [selectedGroup]
  );
  const selectedDetails = teamDetails[selectedRow.group] || [];

  const getScoreColor = (completed, total) => {
    const rate = completed / total;
    if (rate < 0.75) return "text-[#F87171]";
    return "text-[#86EFAC]";
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-extrabold text-[#0F3A63]">Suivi équipe</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">Avancement par groupe de collaborateurs.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {populationRows.map((row) => (
          <button
            key={row.group}
            onClick={() => setSelectedGroup(row.group)}
            className={`rounded-lg bg-[#0D496A] p-4 text-left text-white transition hover:bg-[#0A3F5C] ${
              selectedGroup === row.group ? "ring-2 ring-[#8BC53F] ring-offset-2" : ""
            }`}
          >
            <p className="text-sm font-extrabold">{row.group}</p>
            <p className={`mt-3 text-2xl font-black ${getScoreColor(row.completed, row.total)}`}>
              {row.completed}/{row.total}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-200">{row.missing} évaluation(s) manquante(s)</p>
          </button>
        ))}
      </div>

      <article className="mt-5 rounded-xl border border-slate-100 bg-[#F8FAFC] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[#0F3A63]">Détails - {selectedRow.group}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {selectedRow.completed} évaluation(s) complétée(s) sur {selectedRow.total}.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">
            {selectedRow.missing} manquante(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {selectedDetails.map((member) => (
                <tr key={`${selectedRow.group}-${member.name}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-bold text-[#0F3A63]">{member.name}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{member.role}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(member.status)}`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-black text-[#0F3A63]">{member.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export default PopulationRH;
