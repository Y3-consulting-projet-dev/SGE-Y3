import { useState } from "react";

function formatScore(score) {
  return typeof score === "number" ? score.toFixed(1) : "0.0";
}

function getAverageScore(criteria = []) {
  const scores = criteria.map((criterion) => criterion.score).filter((score) => typeof score === "number");
  if (!scores.length) return null;
  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1));
}

function buildMissionScores(missionEvaluations = []) {
  return missionEvaluations.map((mission) => {
    const score = getAverageScore(mission.criteria);
    return {
      id: mission.id,
      title: mission.title,
      period: mission.period,
      department: mission.department,
      managers: mission.managers || [],
      score,
      percent: Math.round(((score || 0) / 5) * 100),
    };
  });
}

function getManagerRecipients(missionEvaluations = []) {
  const recipients = missionEvaluations.flatMap((mission) =>
    (mission.managers || []).map((manager) => ({ manager, department: mission.department }))
  );
  return recipients.filter(
    (recipient, index, list) =>
      recipient.manager && list.findIndex((item) => item.manager === recipient.manager && item.department === recipient.department) === index
  );
}

function buildLiveResults(evaluationData, resultsData) {
  const sections = evaluationData?.evaluation?.sections || [];
  if (!sections.length) return null;

  const sectionScores = sections.map((section) => {
    const score = getAverageScore(section.criteria);
    return {
      sectionId: section.id,
      title: section.title,
      label: section.subtitle,
      score,
      percent: Math.round(((score || 0) / 5) * 100),
    };
  });

  const validScores = sectionScores.map((section) => section.score).filter((score) => typeof score === "number");
  const scoreFinal = validScores.length
    ? Number((validScores.reduce((total, score) => total + score, 0) / validScores.length).toFixed(1))
    : 0;

  return {
    cycle_label: evaluationData?.evaluation?.cycle_label || resultsData?.cycle_label,
    status: evaluationData?.evaluation?.status || resultsData?.status,
    sectionScores,
    kpis: {
      ...(resultsData?.kpis || {}),
      scoreFinal,
      scoreFinalPercent: Math.round((scoreFinal / 5) * 100),
    },
  };
}

function Mesresultats({ evaluationData, missionEvaluations = [], resultsData, isLoading, errorMessage }) {
  const [reportDownloaded, setReportDownloaded] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement des résultats...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-md bg-white p-4 text-sm font-semibold text-red-600 shadow-sm">
        {errorMessage}
      </div>
    );
  }

  const liveResults = buildLiveResults(evaluationData, resultsData);
  const displayResults = liveResults || resultsData;
  const scoreFinal = displayResults?.kpis?.scoreFinal;
  const moyenneEquipe = displayResults?.kpis?.moyenneEquipe;
  const assistantsEvalues = displayResults?.kpis?.assistantsEvalues || 0;
  const comparaisonEquipeLabel = displayResults?.kpis?.comparaisonEquipeLabel || "0.0";
  const comparaisonEquipeSubtitle = displayResults?.kpis?.comparaisonEquipeSubtitle || "Égal à la moyenne";
  const sectionScores = displayResults?.sectionScores || [];
  const evaluationStatus = displayResults?.status || "En cours";
  const missionScores = buildMissionScores(missionEvaluations);
  const managerRecipients = getManagerRecipients(missionEvaluations);

  const topCards = [
    {
      title: "Score final",
      value: `${formatScore(scoreFinal)}/5`,
      subtitle: "Calculé automatiquement",
    },
    {
      title: "Statut évaluation",
      value: evaluationStatus,
      subtitle: evaluationStatus === "Soumis aux Managers" ? "En attente de retour manager" : "Calcul provisoire",
    },
    {
      title: "Comparaison équipe",
      value: comparaisonEquipeLabel,
      subtitle: comparaisonEquipeSubtitle,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-semibold text-slate-500">
        {displayResults?.cycle_label || "Cycle 2025-2026"} - Résultats actualisés selon l'auto-évaluation par mission et par cycle
      </p>

      {/* <div className="rounded-sm bg-[#BFE2B9] px-4 py-3 text-[12px] font-semibold text-[#114F35]">
        {resultsData?.status === "Soumis a RH"
          ? "Évaluation transmise à la RH / Capital Humain. Résultats issus de l'auto-évaluation."
          : "Résultats provisoires issus de l'auto-évaluation en cours."}
      </div> */}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {topCards.map((card) => (
          <article key={card.title} className="rounded-md bg-[#003B63] px-4 py-3 text-white">
            <h2 className="mb-4 text-[12px] font-bold">{card.title}</h2>
            <p className="text-[18px] font-bold text-[#7BC443]">{card.value}</p>
            <p className="mt-3 text-[12px] font-semibold text-slate-200">{card.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.05fr]">
        <div className="space-y-4">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-[14px] font-bold text-[#0F3A63]">Évaluation par mission</h3>
            <div className="space-y-4">
              {missionScores.length ? (
                missionScores.map((mission) => (
                  <div key={mission.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[13px] font-semibold text-[#0F3A63]">
                      <div>
                        <p>{mission.title}</p>
                        <p className="text-[11px] font-medium text-slate-500">
                          {mission.period} - {mission.department} - {mission.managers.join(", ")}
                        </p>
                      </div>
                      <span>{typeof mission.score === "number" ? mission.score.toFixed(1) : "--"}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-300">
                      <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${mission.percent || 0}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-slate-100 px-3 py-3 text-[12px] font-semibold text-slate-500">
                  Aucune mission ajoutée pour le moment.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-[14px] font-bold text-[#0F3A63]">Évaluation globale du cycle</h3>
            <div className="space-y-4">
              {sectionScores.map((item) => (
                <div key={item.sectionId || item.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-[13px] font-semibold text-[#0F3A63]">
                    <div>
                      <p>{item.title || `Section ${item.sectionId}`}</p>
                      <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
                    </div>
                    <span>{typeof item.score === "number" ? item.score.toFixed(1) : "--"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-300">
                    <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${item.percent || 0}%` }} />
                  </div>
                </div>
              ))}
              <div>
                <div className="mb-1 flex items-center justify-between text-[13px] font-bold text-[#0F3A63]">
                  <p>Score final</p>
                  <span className="text-[#76B82A]">{formatScore(scoreFinal)} / 5</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-300">
                  <div
                    className="h-1.5 rounded-full bg-[#76B82A]"
                    style={{ width: `${displayResults?.kpis?.scoreFinalPercent || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[22px] font-bold leading-tight text-[#0F3A63]">Commentaire du Manager</h3>
            <div className="rounded-md bg-slate-100 p-4">
              <p className="text-[12px] text-slate-600">
                "Mamadou fait preuve d'une bonne rigueur sur les dossiers. Des progres attendus sur la rapidite de
                rendu des rapports. Formation recommandee sur CEGID avance."
              </p>
              <p className="mt-8 text-[12px] font-semibold text-[#0F3A63]">Diallo Seydou - Manager - 28/04/2026</p>
            </div>
          </article>
        </div>

        <div className="space-y-4">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[24px] font-bold leading-tight text-[#0F3A63]">Suivi managers</h3>
              <span className="rounded-md bg-[#DCECCB] px-2 py-0.5 text-[11px] font-bold text-[#76B82A]">
                {evaluationStatus === "Soumis aux Managers" ? "Transmise" : "En préparation"}
              </span>
            </div>

            <div className="rounded-md bg-slate-100 p-3">
              <p className="text-[18px] font-bold text-[#0F3A63]">Auto-évaluation soumise aux managers</p>
              <p className="mt-1 text-[12px] font-semibold text-[#76B82A]">
                Chaque manager reçoit les missions de son département.
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {managerRecipients.length ? (
                managerRecipients.map((recipient) => (
                  <div key={`${recipient.department}-${recipient.manager}`} className="rounded-sm border-l-4 border-[#76B82A] bg-[#EAF5DF] px-3 py-2">
                    <p className="text-[12px] font-bold text-[#0F3A63]">{recipient.manager}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{recipient.department}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-sm bg-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-500">
                  Aucun manager destinataire tant qu'aucune mission n'est ajoutée.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-[20px] font-bold text-[#0F3A63]">Évolution sur 2 cycles</h3>
            <div className="space-y-3 text-[13px] font-semibold">
              <div className="flex items-center justify-between text-[#0F3A63]">
                <p>Cycle 2025-2026</p>
                <p>3.2 / 5 - Maintien</p>
              </div>
              <div className="flex items-center justify-between text-[#76B82A]">
                <p>Cycle 2025-2026</p>
                <p>{formatScore(scoreFinal)} / 5 - Maintien</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-bold text-[#76B82A]">
              Moyenne équipe : {formatScore(moyenneEquipe)} / 5
            </p>
            <p className="mt-1 text-[12px] font-semibold text-[#0F3A63]">
              Comparaison basée sur les scores de {assistantsEvalues} autre(s) Assistant(s).
            </p>
          </article>

          <button
            onClick={() => {
              setReportDownloaded(true);
              window.print();
            }}
            className="mx-auto block rounded-md bg-[#76B82A] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#6EAD28]"
          >
            Télécharger mon rapport PDF
          </button>
          {reportDownloaded ? (
            <p className="text-center text-[11px] font-semibold text-[#76B82A]">Rapport lance pour impression.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default Mesresultats;
