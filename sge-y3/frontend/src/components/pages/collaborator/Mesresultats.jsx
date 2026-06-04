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
      recipients: (mission.recipients || []).map((recipient) => recipient.name).filter(Boolean),
      score,
      percent: Math.round(((score || 0) / 5) * 100),
    };
  });
}

function getRecipientMissions(recipient, missionEvaluations = []) {
  return missionEvaluations
    .filter((mission) =>
      (mission.recipients || []).some(
        (item) => item.name === recipient.manager && (item.department || mission.department) === recipient.department
      )
    )
    .map((mission) => ({
      id: mission.id,
      title: mission.title,
      period: mission.period,
      department: mission.department,
      score: getAverageScore(mission.criteria),
    }));
}

function getManagerRecipients(missionEvaluations = []) {
  const recipients = missionEvaluations.flatMap((mission) =>
    (mission.recipients || []).map((recipient) => ({
      manager: recipient.name,
      grade: recipient.grade,
      department: recipient.department || mission.department,
    }))
  );

  return recipients
    .filter(
      (recipient, index, list) =>
        recipient.manager &&
        list.findIndex((item) => item.manager === recipient.manager && item.department === recipient.department) === index
    )
    .map((recipient) => ({
      ...recipient,
      missions: getRecipientMissions(recipient, missionEvaluations),
    }));
}

function buildLiveResults(evaluationData, resultsData) {
  const missionEvaluations = evaluationData?.mission_evaluations || [];
  if (!missionEvaluations.length) return null;

  const missionScores = buildMissionScores(missionEvaluations);
  const validScores = missionScores.map((mission) => mission.score).filter((score) => typeof score === "number");
  const scoreFinal = validScores.length
    ? Number((validScores.reduce((total, score) => total + score, 0) / validScores.length).toFixed(1))
    : 0;

  return {
    cycle_label: evaluationData?.evaluation?.cycle_label || resultsData?.cycle_label,
    status: evaluationData?.evaluation?.status || resultsData?.status,
    missionScores,
    managerComments: resultsData?.managerComments || [],
    kpis: {
      ...(resultsData?.kpis || {}),
      scoreFinal,
      scoreFinalPercent: Math.round((scoreFinal / 5) * 100),
    },
  };
}

function Mesresultats({ evaluationData, missionEvaluations = [], resultsData, isLoading, errorMessage }) {
  const [reportDownloaded, setReportDownloaded] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);

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
  const moyenneDepartementLabel = displayResults?.kpis?.moyenneDepartementLabel || displayResults?.kpis?.comparaisonEquipeLabel || "0.0/5";
  const moyenneDepartementSubtitle =
    displayResults?.kpis?.moyenneDepartementSubtitle || displayResults?.kpis?.comparaisonEquipeSubtitle || "Moyenne du département";
  const missionScores = displayResults?.missionScores || buildMissionScores(missionEvaluations);
  const managerComments = displayResults?.managerComments || [];
  const evaluationStatus = displayResults?.status || "En cours";
  const managerRecipients = getManagerRecipients(missionEvaluations);

  const topCards = [
    {
      title: "Score final",
      value: `${formatScore(scoreFinal)}/5`,
      subtitle: "Moyenne de toutes les missions notées",
    },
    {
      title: "Statut évaluation",
      value: evaluationStatus,
      subtitle: evaluationStatus === "Soumis aux Managers" ? "En attente de retour manager" : "Calcul provisoire",
    },
    {
      title: "Moyenne du département",
      value: moyenneDepartementLabel,
      subtitle: moyenneDepartementSubtitle,
    },
  ];

  function formatCommentDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("fr-FR");
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-semibold text-slate-500">
        {displayResults?.cycle_label || "Cycle 2025-2026"} - Résultats actualisés selon les évaluations par mission
      </p>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {topCards.map((card) => (
          <article key={card.title} className="rounded-md bg-[#003B63] px-4 py-3 text-white">
            <h2 className="mb-4 text-[12px] font-bold">{card.title}</h2>
            <p className="text-[18px] font-bold text-[#7BC443]">{card.value}</p>
            <p className="mt-3 text-[12px] font-semibold text-slate-200">{card.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex justify-between">
          <article className="rounded-md w-[53%] bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-[#0F3A63]">Synthèse finale</h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  Missions évaluées, score final et destinataires associés au même endroit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipient({ manager: "__all__", department: "Tous", missions: missionScores })}
                className="rounded-md bg-[#EAF5DF] px-4 py-2 text-[12px] font-bold text-[#4E8B1B] hover:bg-[#DCECCB]"
              >
                Voir les destinataires ({managerRecipients.length})
              </button>
            </div>
            <div className="space-y-4">
              {missionScores.map((item) => (
                <div key={item.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-[13px] font-semibold text-[#0F3A63]">
                    <div>
                      <p>{item.title}</p>
                      <p className="text-[11px] font-medium text-slate-500">{item.period} - {item.department}</p>
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
                  <p className="text-[20px]">Score final moyen</p>
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

          <article className="rounded-md w-[45%] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[22px] font-bold leading-tight text-[#0F3A63]">Commentaire du Manager</h3>
            <div className="space-y-3">
              {managerComments.length ? (
                managerComments.map((item, index) => (
                  <div key={`${item.managerId}-${index}`} className="rounded-md bg-slate-100 p-4">
                    <p className="text-[12px] text-slate-600">{item.comment}</p>
                    <p className="mt-8 text-[12px] font-semibold text-[#0F3A63]">
                      {item.authorName} - {item.authorGrade}
                      {formatCommentDate(item.submittedAt) ? ` - ${formatCommentDate(item.submittedAt)}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-md bg-slate-100 p-4">
                  <p className="text-[12px] text-slate-600">
                    Les commentaires du ou des managers apparaîtront ici lorsqu'ils seront disponibles après le circuit de validation.
                  </p>
                </div>
              )}
            </div>
          </article>

        </div>

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
            <p className="text-center text-[11px] font-semibold text-[#76B82A]">Rapport lancé pour impression.</p>
          ) : null}
      </section>

      {selectedRecipient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase text-[#76B82A]">Destinataires</p>
                <h3 className="mt-1 text-[20px] font-black text-[#0F3A63]">
                  Managers et associés destinataires
                </h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  Chaque destinataire est rattaché aux missions qui lui ont été transmises.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipient(null)}
                className="rounded-full bg-slate-100 px-3 py-1 text-[13px] font-black text-[#0F3A63]"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {managerRecipients.length ? (
                managerRecipients.map((recipient) => (
                  <article key={`${recipient.department}-${recipient.manager}`} className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-black text-[#0F3A63]">{recipient.manager}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {[recipient.grade, recipient.department].filter(Boolean).join(" - ")}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EAF5DF] px-3 py-1 text-[11px] font-bold text-[#4E8B1B]">
                        {recipient.missions.length} mission(s)
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {recipient.missions.map((mission) => (
                        <div key={`${recipient.manager}-${mission.id}`} className="rounded-md bg-white px-3 py-2">
                          <div className="flex items-center justify-between gap-3 text-[12px] font-bold text-[#0F3A63]">
                            <span>{mission.title}</span>
                            <span>{typeof mission.score === "number" ? `${formatScore(mission.score)}/5` : "--"}</span>
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            {mission.period} - {mission.department}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg bg-slate-100 p-4 text-[12px] font-semibold text-slate-500">
                  Aucun destinataire tant qu'aucune mission n'est ajoutée.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Mesresultats;
