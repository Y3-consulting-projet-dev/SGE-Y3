import { assistantEvaluations } from "@/components/pages/senior/seniorData";

function MesobjectifsSenior() {
  const missions = assistantEvaluations.flatMap((assistant) =>
    assistant.missions.map((mission) => ({
      ...mission,
      assistant: assistant.name,
      role: assistant.role,
    }))
  );

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {missions.map((mission) => (
        <article key={`${mission.assistant}-${mission.title}`} className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#79B742]">{mission.assistant} - {mission.role}</p>
              <h2 className="mt-1 text-lg font-extrabold text-[#0F3A63]">{mission.title}</h2>
            </div>
            <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.result}</span>
          </div>
          <p className="text-sm font-semibold text-slate-500">{mission.period}</p>
          <p className="mt-3 text-sm font-semibold text-[#0F3A63]">{mission.context}</p>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">Role du Senior</p>
            <p className="mt-1 text-sm font-bold text-[#0F3A63]">{mission.seniorRole}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default MesobjectifsSenior;
