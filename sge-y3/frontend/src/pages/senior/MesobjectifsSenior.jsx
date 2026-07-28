function MesobjectifsSenior({ missions = [], isLoading, errorMessage }) {
  if (isLoading) {
    return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des missions communes...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-lg bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!missions.length) {
    return (
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-[#0F3A63]">Missions communes</h2>
        <p className="mt-3 text-sm font-semibold text-slate-500">Aucune mission soumise par vos assistants ne vous est encore adressée.</p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {missions.map((mission) => (
        <article key={`${mission.assistantId}-${mission.title}-${mission.period}`} className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#79B742]">
                {mission.assistantName} - {mission.assistantGrade}
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-[#0F3A63]">{mission.title}</h2>
            </div>
            <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.status}</span>
          </div>
          <p className="text-sm font-semibold text-slate-500">{mission.period || "Période non renseignée"}</p>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">Département</p>
            <p className="mt-1 text-sm font-bold text-[#0F3A63]">{mission.department}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default MesobjectifsSenior;
