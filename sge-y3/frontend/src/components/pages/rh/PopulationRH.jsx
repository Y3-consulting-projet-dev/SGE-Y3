import { useEffect, useMemo, useState } from "react";
import { getRhPopulation } from "@/lib/rhOverview";

function statusClass(status) {
  if (status === "Validé" || status === "Valide") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "A completer") return "bg-[#FFF2CC] text-[#8A6810]";
  if (status === "Ecart a arbitrer") return "bg-[#F9DFDF] text-[#B63232]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function PopulationRH() {
  const [data, setData] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("Managers");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPopulation() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhPopulation();
        if (!cancelled) {
          setData(response);
          setSelectedGroup(response.groups?.[0]?.group || "Managers");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement de l'equipe impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPopulation();
    return () => {
      cancelled = true;
    };
  }, []);

  const populationRows = data?.groups || [];
  const selectedRow = useMemo(
    () => populationRows.find((row) => row.group === selectedGroup) || populationRows[0],
    [populationRows, selectedGroup]
  );
  const selectedDetails = selectedRow?.members || [];

  const getScoreColor = (completed, total) => {
    const rate = total ? completed / total : 0;
    if (rate < 0.75) return "text-[#F87171]";
    return "text-[#86EFAC]";
  };

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'equipe...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-extrabold text-[#0F3A63]">Suivi equipe</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">Avancement par groupe de collaborateurs.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <p className="mt-2 text-xs font-semibold text-slate-200">{row.missing} evaluation(s) manquante(s)</p>
          </button>
        ))}
      </div>

      {selectedRow ? (
        <article className="mt-5 rounded-xl border border-slate-100 bg-[#F8FAFC] p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-[#0F3A63]">Details - {selectedRow.group}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {selectedRow.completed} evaluation(s) completee(s) sur {selectedRow.total}.
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
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {selectedDetails.map((member) => (
                  <tr key={`${selectedRow.group}-${member.id}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-bold text-[#0F3A63]">{member.name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{member.role}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(member.status)}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-[#0F3A63]">
                      {typeof member.score === "number" ? member.score : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default PopulationRH;
