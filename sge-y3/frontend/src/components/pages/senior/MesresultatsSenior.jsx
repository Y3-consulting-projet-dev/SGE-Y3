import { assistantEvaluations } from "@/components/pages/senior/seniorData";

function MesresultatsSenior() {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#003B63] text-left text-white">
            <th className="px-4 py-4 font-semibold">Assistant</th>
            <th className="px-4 py-4 font-semibold">Missions évaluées</th>
            <th className="px-4 py-4 font-semibold">Score Senior moyen</th>
            <th className="px-4 py-4 font-semibold">Statut</th>
            <th className="px-4 py-4 font-semibold">Manager destinataire</th>
          </tr>
        </thead>
        <tbody>
          {assistantEvaluations.map((assistant) => {
            const scores = assistant.missions.flatMap((mission) => mission.criteria.map((criterion) => criterion.senior));
            const average = (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
            return (
              <tr key={assistant.name} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                <td className="px-4 py-4 font-bold">{assistant.name}</td>
                <td className="px-4 py-4">{assistant.missions.length}</td>
                <td className="px-4 py-4 font-bold text-[#76B82A]">{average} / 5</td>
                <td className="px-4 py-4">{assistant.status}</td>
                <td className="px-4 py-4">{assistant.manager}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default MesresultatsSenior;
