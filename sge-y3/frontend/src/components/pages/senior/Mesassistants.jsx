import { assistantRows } from "@/components/pages/senior/seniorData";

function Mesassistants({ onOpenReview }) {
  const statusClass = (status) => {
    if (status === "Avis a transmettre") return "bg-[#76B82A] text-white";
    if (status === "En observation") return "bg-[#4B73D9] text-white";
    return "bg-slate-100 text-[#0E4A6B]";
  };

  return (
    <section className="overflow-hidden rounded-md bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#003B63] text-left text-white">
            <th className="px-4 py-4 font-semibold">Assistant</th>
            <th className="px-4 py-4 font-semibold">Role</th>
            <th className="px-4 py-4 font-semibold">Missions communes</th>
            <th className="px-4 py-4 font-semibold">Missions pretes</th>
            <th className="px-4 py-4 font-semibold">Statut evaluation</th>
            <th className="px-4 py-4 font-semibold">Prochaine action</th>
            <th className="px-4 py-4 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {assistantRows.map((row) => (
            <tr key={row.name} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
              <td className="px-4 py-4 font-bold">{row.name}</td>
              <td className="px-4 py-4">{row.role}</td>
              <td className="px-4 py-4">{row.sharedMissions}</td>
              <td className="px-4 py-4 font-bold">{row.readyMissions}</td>
              <td className="px-4 py-4">
                <span className={`inline-flex rounded-xl px-3 py-1 text-xs font-bold ${statusClass(row.evaluationStatus)}`}>
                  {row.evaluationStatus}
                </span>
              </td>
              <td className="px-4 py-4">{row.nextAction}</td>
              <td className="px-4 py-4">
                <button onClick={onOpenReview} className="font-bold text-[#2E5BC8] hover:underline">
                  Evaluer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default Mesassistants;
