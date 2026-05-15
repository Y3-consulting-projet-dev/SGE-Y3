import { useEffect, useState } from "react";
import { getSeniorTransmittedSummaries } from "@/lib/seniorAssistants";

function formatDate(value) {
  if (!value) return "Non precisee";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Non precisee";
  }

  return date.toLocaleDateString("fr-FR");
}

function MesresultatsSenior() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSummaries() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getSeniorTransmittedSummaries();

        if (cancelled) return;
        setData(response);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des syntheses transmises impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSummaries();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des synthèses transmises...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!data?.rows?.length) {
    return (
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">Aucune évaluation par mission n'a encore été transmise au manager.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Assistants suivis</p>
          <p className="mt-2 text-3xl font-black text-[#0F3A63]">{data.totalAssistants || 0}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Missions transmises</p>
          <p className="mt-2 text-3xl font-black text-[#0F3A63]">{data.totalMissions || 0}</p>
        </article>
      </div>

      {data.rows.map((row) => (
        <article key={row.assistant.id} className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#0F3A63]">{row.assistant.name}</h2>
              <p className="text-sm font-semibold text-slate-500">
                {row.assistant.grade} - {row.assistant.department}
              </p>
            </div>
            <span className="rounded-full bg-[#EEF6E8] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
              {row.missions.length} mission(s) transmise(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#003B63] text-left text-white">
                  <th className="px-4 py-4 font-semibold">Mission</th>
                  <th className="px-4 py-4 font-semibold">Période</th>
                  <th className="px-4 py-4 font-semibold">Score Sénior moyen</th>
                  <th className="px-4 py-4 font-semibold">Statut</th>
                  <th className="px-4 py-4 font-semibold">Manager destinataire</th>
                  <th className="px-4 py-4 font-semibold">Date d'envoi</th>
                </tr>
              </thead>
              <tbody>
                {row.missions.map((mission) => (
                  <tr key={mission.id} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                    <td className="px-4 py-4">
                      <p className="font-bold">{mission.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{mission.department}</p>
                    </td>
                    <td className="px-4 py-4">{mission.period || "Non precisee"}</td>
                    <td className="px-4 py-4 font-bold text-[#76B82A]">
                      {mission.averageScore !== null ? `${mission.averageScore} / 5` : "--"}
                    </td>
                    <td className="px-4 py-4">{mission.status}</td>
                    <td className="px-4 py-4">{(mission.managerNames || []).join(", ") || "Manager du departement"}</td>
                    <td className="px-4 py-4">{formatDate(mission.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}

export default MesresultatsSenior;
