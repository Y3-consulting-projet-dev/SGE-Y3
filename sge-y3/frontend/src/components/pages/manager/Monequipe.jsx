import { Search } from "lucide-react";

const teamMembers = [
  {
    name: "Habib Bah",
    role: "assistant",
    seniority: "3 ans",
    status: "Soumise",
    score: "3.8 / 5",
    action: "Corriger",
    actionTarget: "team-review",
  },
  {
    name: "Kader Kone",
    role: "assistant",
    seniority: "2 ans",
    status: "En cours",
    score: "",
    action: "Voir",
    actionTarget: "team",
  },
  {
    name: "Orlane Kone",
    role: "assistante",
    seniority: "1 an",
    status: "En cours",
    score: "",
    action: "Voir",
    actionTarget: "team",
  },
  {
    name: "Yasmine K",
    role: "Senior",
    seniority: "3 ans",
    status: "Valide RH",
    score: "4.2 / 5",
    action: "Voir",
    actionTarget: "reports",
  },
  {
    name: "Louise Yao",
    role: "assistante",
    seniority: "6 mois",
    status: "Brouillon",
    score: "",
    action: "Relancer",
    actionTarget: "notifications",
  },
];

function Monequipe({ searchTerm, onSearchChange, onAction, onEvaluate, onRelance, relanceMessage, extraMembers = [] }) {
  const allMembers = [...teamMembers, ...extraMembers];
  const rows = allMembers.filter((member) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      member.name.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query) ||
      member.status.toLowerCase().includes(query)
    );
  });

  const statusClass = (status) => {
    if (status === "Soumise") return "bg-[#DFECD4] text-[#0E4A6B]";
    if (status === "En cours") return "bg-[#4B73D9] text-white";
    if (status === "Valide RH") return "bg-[#76B82A] text-white";
    return "bg-slate-100 text-[#0E4A6B]";
  };

  const actionClass = (action) => {
    if (action === "Corriger") return "text-[#E53935]";
    if (action === "Relancer") return "text-[#D79C0F]";
    return "text-[#2E5BC8]";
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        {relanceMessage ? (
          <p className="w-full rounded-md bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
            {relanceMessage}
          </p>
        ) : null}
        <div className="relative w-full max-w-[360px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher"
            className="h-11 w-full rounded-full border border-[#0E4A6B]/40 bg-transparent px-4 pr-11 text-sm text-[#0E4A6B] outline-none placeholder:text-slate-400"
          />
          <Search size={18} className="pointer-events-none absolute right-4 top-3.5 text-slate-400" />
        </div>
      </div>

      <section className="overflow-hidden rounded-md bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#003B63] text-left text-white">
              <th className="px-4 py-4 font-semibold">Collaborateur</th>
              <th className="px-4 py-4 font-semibold">Role</th>
              <th className="px-4 py-4 font-semibold">Anciennete</th>
              <th className="px-4 py-4 font-semibold">Statut eval.</th>
              <th className="px-4 py-4 font-semibold">Score auto-eval</th>
              <th className="px-4 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr
                key={member.name}
                onClick={() => onEvaluate(member)}
                className="cursor-pointer border-b border-slate-100 text-[#0F3A63] transition hover:bg-slate-50 last:border-0"
              >
                <td className="px-4 py-4 font-semibold">{member.name}</td>
                <td className="px-4 py-4">{member.role}</td>
                <td className="px-4 py-4">{member.seniority}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex min-w-[94px] justify-center rounded-xl px-3 py-1 text-xs font-semibold ${statusClass(member.status)}`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-4 font-semibold">{member.score || "-"}</td>
                <td className="px-4 py-4">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      if (member.actionTarget === "notifications") {
                        onRelance(member);
                        return;
                      }
                      onEvaluate(member);
                    }}
                    className={`font-semibold hover:underline ${actionClass(member.action)}`}
                  >
                    {member.action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default Monequipe;
