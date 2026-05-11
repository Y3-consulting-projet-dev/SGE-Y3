import { assistantRows, priorityActions } from "@/components/pages/senior/seniorData";

function Vueensemble({ onOpen }) {
  return (
    <>
      <div className="mb-6 border-l-4 border-[#7CB342] bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
        Le Senior évalue uniquement les assistants avec lesquels il a travaillé, mission par mission, à partir des faits observés.
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button onClick={() => onOpen("assistants")} className="rounded-lg bg-[#003B63] p-5 text-left text-white">
          <p className="text-sm">Assistants encadres</p>
          <p className="mt-3 text-3xl font-extrabold">3</p>
          <p className="mt-2 text-sm text-slate-200">sur missions communes</p>
        </button>
        <button onClick={() => onOpen("reviews")} className="rounded-lg bg-[#003B63] p-5 text-left text-white">
          <p className="text-sm">Missions à évaluer</p>
          <p className="mt-3 text-3xl font-extrabold text-[#F34D4D]">2</p>
          <p className="mt-2 text-sm text-slate-200">avis Senior incomplets</p>
        </button>
        <button onClick={() => onOpen("goals")} className="rounded-lg bg-[#003B63] p-5 text-left text-white">
          <p className="text-sm">Missions communes</p>
          <p className="mt-3 text-3xl font-extrabold text-[#7BC443]">5</p>
          <p className="mt-2 text-sm text-slate-200">dossiers partages</p>
        </button>
        <button onClick={() => onOpen("results")} className="rounded-lg bg-[#003B63] p-5 text-left text-white">
          <p className="text-sm">Synthèses transmises</p>
          <p className="mt-3 text-3xl font-extrabold text-[#7BC443]">1</p>
          <p className="mt-2 text-sm text-slate-200">prêtes pour Manager</p>
        </button>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-sm font-bold text-[#0F3A63]">Suivi des missions par assistant</h2>
          <div className="space-y-4">
            {assistantRows.map((row) => (
              <button
                key={row.name}
                onClick={() => onOpen("assistants")}
                className="grid w-full grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 text-left md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-bold text-[#0F3A63]">{row.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{row.sharedMissions}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-[#4E8B1B]">{row.readyMissions}</span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-[#0F3A63]">{row.evaluationStatus}</span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#0F3A63]">Actions prioritaires</h2>
          <div className="space-y-3">
            {priorityActions.map((action, index) => (
              <button
                key={action.title}
                onClick={() => onOpen(action.target)}
                className="w-full rounded-lg bg-[#DFECD4] p-3 text-left hover:bg-[#D1E6C0]"
              >
                <div className="flex items-start gap-2">
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1A93CA] text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#0F3A63]">{action.title}</p>
                    <p className="text-xs text-slate-500">{action.subtitle}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

export default Vueensemble;
