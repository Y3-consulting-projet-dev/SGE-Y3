import { Search } from "lucide-react";

function formatEvalStatus(status = "") {
  if (status === "Soumis a RH") return "Soumise";
  if (status === "Soumis aux Managers" || status === "Soumis au Manager") return "Soumise";
  if (status === "En cours") return "En cours";
  if (status === "Valide RH") return "Soumise";
  return "En attente";
}

function getMemberAction() {
  return { label: "Voir", actionTarget: "team" };
}

function Monequipe({ searchTerm, onSearchChange, onEvaluate, relanceMessage, members = [], extraMembers = [] }) {
  const allMembers = [
    ...members.map((member) => {
      const action = getMemberAction();

      return {
        ...member,
        role: member.grade,
        status: formatEvalStatus(member.evaluationStatus),
        score: typeof member.selfEvaluationScore === "number" ? `${member.selfEvaluationScore} / 5` : "",
        action: action.label,
        actionTarget: action.actionTarget,
      };
    }),
    ...extraMembers,
  ];
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
    return "bg-slate-100 text-[#0E4A6B]";
  };

  const actionClass = () => "text-[#2E5BC8]";

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
        {!rows.length ? (
          <div className="p-5 text-sm font-semibold text-slate-500">Aucun membre trouve dans votre perimetre.</div>
        ) : null}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#003B63] text-left text-white">
              <th className="px-4 py-4 font-semibold">Collaborateur</th>
              <th className="px-4 py-4 font-semibold">Rôle</th>
              <th className="px-4 py-4 font-semibold">Statut évaluation</th>
              <th className="px-4 py-4 font-semibold">Score auto-évaluation</th>
              <th className="px-4 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr
                key={member.id || member.name}
                onClick={() => onEvaluate(member)}
                className="cursor-pointer border-b border-slate-100 text-[#0F3A63] transition hover:bg-slate-50 last:border-0"
              >
                <td className="px-4 py-4 font-semibold">{member.name}</td>
                <td className="px-4 py-4">{member.role}</td>
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
