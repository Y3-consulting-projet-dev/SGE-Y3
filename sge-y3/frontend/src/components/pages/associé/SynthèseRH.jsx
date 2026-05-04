import { useMemo, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";

const rows = [
  {
    initials: "DS",
    name: "Diallo Seydou",
    subtitle: "Auto-eval inclus",
    role: "Manager",
    manager: "Vous-meme",
    score: "3.9/5",
    scoreClass: "text-[#7DBA45]",
    alert: "",
    decision: "A decider",
    decisionClass: "text-[#C53B3B]",
    action: "Ouvrir",
  },
  {
    initials: "KA",
    name: "Kouame Assi",
    subtitle: "Audit Senior",
    role: "Senior",
    manager: "Axelle A",
    score: "4.1/5",
    scoreClass: "text-[#7DBA45]",
    alert: "",
    decision: "",
    decisionClass: "",
    action: "Ouvrir",
  },
  {
    initials: "YE",
    name: "Yao Emmanuel",
    subtitle: "Collaborateur",
    role: "Collab",
    manager: "Axelle A",
    score: "2.8/5",
    scoreClass: "text-[#C53B3B]",
    alert: "Ecart",
    decision: "",
    decisionClass: "",
    action: "Examiner",
  },
  {
    initials: "GN",
    name: "Gbagbo Nadege",
    subtitle: "Collaboratrice",
    role: "Collab",
    manager: "Axelle A",
    score: "4.2/5",
    scoreClass: "text-[#7DBA45]",
    alert: "",
    decision: "Augmentation",
    decisionClass: "text-[#7DBA45]",
    action: "Voir",
  },
  {
    initials: "TM",
    name: "Traore Mamadou",
    subtitle: "Collaborateur",
    role: "Collab",
    manager: "Axelle A",
    score: "3.0/5",
    scoreClass: "text-[#0F4A72]",
    alert: "",
    decision: "Maintien",
    decisionClass: "text-[#0F4A72]",
    action: "Voir",
  },
];

function SyntheseRH() {
  const [roleFilter, setRoleFilter] = useState("Tous les roles");
  const [decisionFilter, setDecisionFilter] = useState("Toutes les decisions");
  const [selectedRow, setSelectedRow] = useState(null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const roleMatch = roleFilter === "Tous les roles" || row.role === roleFilter;
        const decisionValue = row.decision || "Sans decision";
        const decisionMatch = decisionFilter === "Toutes les decisions" || decisionValue === decisionFilter;
        return roleMatch && decisionMatch;
      }),
    [decisionFilter, roleFilter],
  );

  const cycleRoleFilter = () => {
    const options = ["Tous les roles", "Manager", "Senior", "Collab"];
    const nextIndex = (options.indexOf(roleFilter) + 1) % options.length;
    setRoleFilter(options[nextIndex]);
  };

  const cycleDecisionFilter = () => {
    const options = ["Toutes les decisions", "A decider", "Augmentation", "Maintien", "Sans decision"];
    const nextIndex = (options.indexOf(decisionFilter) + 1) % options.length;
    setDecisionFilter(options[nextIndex]);
  };

  const handleRowAction = (row) => {
    setSelectedRow(row.name);
    window.alert(`${row.action} : ${row.name}`);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">Syntheses validees RH</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => window.alert("Notifications bientot disponibles.")} className="rounded-full p-2 text-slate-500 hover:bg-slate-200/70">
            <Bell size={16} />
          </button>
          <button onClick={() => window.print()} className="rounded-full bg-[#7EB83E] px-4 py-2 text-xs font-bold text-white hover:bg-[#73AB39]">
            Exporter syntheses
          </button>
        </div>
      </header>

      <section className="rounded-md border-l-4 border-[#6FB33E] bg-[#DDECD8] px-4 py-3 text-sm font-semibold text-[#204B2E]">
        Seules les evaluations au statut Valide RH sont visibles ici. Vous n'avez pas acces aux evaluations en cours de validation.
      </section>

      <section className="rounded-xl bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button onClick={cycleRoleFilter} className="inline-flex items-center gap-2 rounded-lg bg-[#7EB83E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#73AB39]">
            {roleFilter}
            <ChevronDown size={14} />
          </button>
          <button onClick={cycleDecisionFilter} className="inline-flex items-center gap-2 rounded-lg bg-[#7EB83E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#73AB39]">
            {decisionFilter}
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse">
            <thead>
              <tr className="bg-[#0C4B6C] text-left text-xs font-semibold text-white">
                <th className="px-3 py-3">Collaborateur</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Manager</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Alerte</th>
                <th className="px-3 py-3">Decision</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.name} className="border-b border-slate-100 text-sm text-[#0F3A63] last:border-0">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                        {row.initials}
                      </span>
                      <div>
                        <p className="font-extrabold">{row.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.subtitle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-md bg-[#DEE8F3] px-2 py-1 text-xs font-semibold text-[#356082]">{row.role}</span>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold">{row.manager}</td>
                  <td className={`px-3 py-3 text-xs font-bold ${row.scoreClass}`}>{row.score}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-[#C53B3B]">{row.alert}</td>
                  <td className={`px-3 py-3 text-xs font-bold ${row.decisionClass}`}>{row.decision}</td>
                  <td className="px-3 py-3 text-xs font-bold text-[#0F4A72]">
                    <button onClick={() => handleRowAction(row)} className="hover:underline">
                      {selectedRow === row.name ? "Ouvert" : row.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default SyntheseRH;
