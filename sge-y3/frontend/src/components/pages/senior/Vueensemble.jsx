function StatCard({ label, value, subtitle, accentClass = "text-white", onClick }) {
  return (
    <button onClick={onClick} className="rounded-lg bg-[#003B63] p-5 text-left text-white">
      <p className="text-sm">{label}</p>
      <p className={`mt-3 text-3xl font-extrabold ${accentClass}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-200">{subtitle}</p>
    </button>
  );
}

function Vueensemble({ onOpen, onOpenReview, overviewData, isLoading, errorMessage }) {
  const summary = overviewData?.summary || {};
  const assistantRows = overviewData?.assistants || [];
  const priorityActions = [
    summary.missionsAEvaluerCount > 0
      ? {
          title: "Finaliser les avis Senior",
          subtitle: `${summary.missionsAEvaluerCount} mission(s) encore à évaluer`,
          target: "reviews",
        }
      : null,
    summary.synthesesTransmisesCount > 0
      ? {
          title: "Consulter les synthèses transmises",
          subtitle: `${summary.synthesesTransmisesCount} synthèse(s) déjà transmise(s)`,
          target: "results",
        }
      : null,
    summary.missionsCommunesCount > 0
      ? {
          title: "Consulter les missions communes",
          subtitle: `${summary.missionsCommunesCount} mission(s) soumise(s) par vos assistants`,
          target: "goals",
        }
      : null,
    {
      title: "Mettre à jour mon auto-évaluation",
      subtitle: "Poursuivre la saisie de votre cycle Senior",
      target: "self-evaluation",
    },
  ].filter(Boolean);

  return (
    <>
      <div className="mb-6 border-l-4 border-[#7CB342] bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
        Le Senior évalue uniquement les assistants avec lesquels il a travaillé, mission par mission, à partir des faits observés.
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && (overviewData?.anonymousComments || []).length > 0 && (
        <button
          type="button"
          onClick={() => onOpen("comments")}
          className="mb-6 w-full rounded-lg border border-[#C3DFAA] bg-[#F4FAED] px-4 py-3 text-left transition hover:bg-[#EAF5D8]"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-[#184D2E]">
              {(overviewData.anonymousComments || []).length} commentaire{(overviewData.anonymousComments || []).length > 1 ? "s" : ""} anonyme{(overviewData.anonymousComments || []).length > 1 ? "s" : ""} reçu{(overviewData.anonymousComments || []).length > 1 ? "s" : ""}
            </p>
            <span className="text-xs font-semibold text-[#4E8B1B]">Consulter →</span>
          </div>
        </button>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          onClick={() => onOpen("assistants")}
          label="Assistants encadrés"
          value={isLoading ? "..." : summary.assistantsEncadresCount || 0}
          subtitle="sur missions communes"
        />
        <StatCard
          onClick={() => onOpen("reviews")}
          label="Missions à évaluer"
          value={isLoading ? "..." : summary.missionsAEvaluerCount || 0}
          subtitle="missions soumises non évaluées"
          accentClass="text-[#F34D4D]"
        />
        <StatCard
          onClick={() => onOpen("goals")}
          label="Missions communes"
          value={isLoading ? "..." : summary.missionsCommunesCount || 0}
          subtitle="dossiers partagés"
          accentClass="text-[#7BC443]"
        />
        <StatCard
          onClick={() => onOpen("results")}
          label="Synthèses transmises"
          value={isLoading ? "..." : summary.synthesesTransmisesCount || 0}
          subtitle="prêtes pour Manager"
          accentClass="text-[#7BC443]"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-sm font-bold text-[#0F3A63]">Suivi des missions par assistant</h2>

          {isLoading ? (
            <p className="text-sm text-slate-500">Chargement des assistants encadrés...</p>
          ) : assistantRows.length ? (
            <div className="space-y-4">
              {assistantRows.map((assistant) => (
                <button
                  key={assistant.assistantId}
                  onClick={() => onOpenReview?.(assistant.assistantId)}
                  className="grid w-full grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 text-left md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-bold text-[#0F3A63]">{assistant.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {assistant.department || "Département non renseigné"} - {assistant.sharedMissionsCount} mission(s) commune(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-[#4E8B1B]">
                      {assistant.transmittedMissionsCount} transmise(s)
                    </span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[#0F3A63]">
                      {assistant.pendingMissionsCount} à évaluer
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucun assistant ne vous a encore soumis de mission commune.</p>
          )}
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
