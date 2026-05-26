import { useEffect, useState } from "react";
import { getSeniorTransmittedSummaries } from "@/lib/seniorAssistants";

function formatDate(value) {
  if (!value) return "Non précisée";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Non précisée";
  }

  return date.toLocaleDateString("fr-FR");
}

function formatScore(score) {
  return typeof score === "number" ? `${score} / 5` : "--";
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
          setErrorMessage(error.message || "Chargement des synthèses transmises impossible.");
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
        <p className="text-sm font-semibold text-slate-500">Aucune mission auto-évaluée n'a encore été soumise par un assistant.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#0F3A63]">{row.assistant.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {row.assistant.grade} - {row.assistant.department}
              </p>
            </div>
            <span className="rounded-full bg-[#EEF6E8] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
              {row.missions.length} mission(s) reçue(s)
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {row.missions.map((mission) => (
              <div key={mission.id} className="rounded-2xl border border-[#D8E4F1] bg-[#F8FBFE] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-[#0F3A63]">{mission.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{mission.department || "Département non précisé"}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Période : {mission.period || "Non précisée"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Envoyée le {formatDate(mission.submittedAt)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Soumise à : {mission.recipientName || "Senior du département"}
                    </p>
                  </div>

                  <div className="grid min-w-[240px] grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Score mission</p>
                      <p className="mt-2 text-lg font-black text-[#4E8B1B]">{formatScore(mission.averageScore)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {(mission.sections || []).map((section) => (
                    <div key={`${mission.id}-${section.title}`} className="rounded-2xl border border-[#D9E3EE] bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">Section</p>
                          <h4 className="mt-1 text-lg font-black text-[#0F3A63]">{section.title || "Section"}</h4>
                        </div>
                        <span className="rounded-full bg-[#EEF6E8] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
                          {formatScore(section.averageScore)}
                        </span>
                      </div>

                      <div className="mt-3 rounded-xl bg-[#F8FBFE] p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Commentaire de section</p>
                        <p className="mt-2 text-sm font-semibold text-[#0F3A63]">
                          {section.comment || "Aucun commentaire de section renseigné."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {!mission.sections?.length ? (
                  <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                    Aucun détail de section n'est disponible pour cette mission.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

export default MesresultatsSenior;
