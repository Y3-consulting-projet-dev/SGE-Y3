import { useEffect, useMemo, useState } from "react";
import { getManagerTeamReport } from "@/lib/managerOverview";

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatScore(score) {
  return typeof score === "number" ? `${score}/5` : "--";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function getFinalDecisionLabel(row) {
  return row.finalDecision || row.final_decision || "En attente";
}

function getFinalDecisionClass(decision) {
  if (decision === "Promu") {
    return "bg-[#DFECD4] text-[#73AF2E]";
  }

  if (decision === "Maintenu" || decision === "Maintien") {
    return "bg-[#F5DFC2] text-[#D48A2A]";
  }

  return "bg-slate-200 text-slate-600";
}

function buildScoreTooltip(details = []) {
  if (!details.length) {
    return "Aucun score soumis pour le moment.";
  }

  return details
    .map((detail) => {
      const evaluator = [detail.evaluatorName, detail.evaluatorGrade].filter(Boolean).join(" - ");
      const mission = detail.missionTitle ? ` | Mission: ${detail.missionTitle}` : "";
      const date = detail.submittedAt ? ` | ${formatDate(detail.submittedAt)}` : "";
      return `${detail.source}: ${evaluator}${mission} | Score: ${formatScore(detail.score)}${date}`;
    })
    .join("\n");
}

function buildCsvReport(rows) {
  const header = ["Collaborateur", "Score missions", "Score globaux", "Décision finale"];
  const values = rows.map((row) => [
    row.name,
    formatScore(row.missionScore),
    formatScore(row.globalScore),
    getFinalDecisionLabel(row),
  ]);

  return [header, ...values].map((line) => line.map((cell) => `"${cell}"`).join(";")).join("\n");
}

function buildPrintableReport(title, rows, cycleLabel) {
  const bodyRows = rows
    .map(
      (row) => `
        <tr>
          <td>${row.name}</td>
          <td>${formatScore(row.missionScore)}</td>
          <td>${formatScore(row.globalScore)}</td>
          <td>${getFinalDecisionLabel(row)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0F3A63; padding: 24px; }
      h1 { font-size: 22px; margin-bottom: 8px; }
      p { color: #475569; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
      th { background: #003B63; color: white; text-align: left; padding: 10px; }
      td { border-bottom: 1px solid #e2e8f0; padding: 10px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>Reporting d'équipe - ${cycleLabel}</p>
    <table>
      <thead>
        <tr>
          <th>Collaborateur</th>
          <th>Score missions</th>
          <th>Score globaux</th>
          <th>Decision finale</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`;
}

function ScoreWithTooltip({ score, details = [] }) {
  const hasDetails = details.length > 0;

  if (typeof score !== "number") {
    return <span className="font-bold text-[#0F3A63]">--</span>;
  }

  return (
    <div className="group relative inline-flex">
      <span className="cursor-help font-bold text-[#0F3A63] underline decoration-dotted underline-offset-4">
        {formatScore(score)}
      </span>
      {hasDetails ? (
        <div className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 w-[320px] rounded-md bg-[#0F3A63] p-3 text-xs text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
          <p className="mb-2 font-bold">Détail des scores calculés</p>
          <div className="space-y-2">
            {details.map((detail, index) => (
              <div key={`${detail.source}-${detail.evaluatorName}-${detail.missionTitle}-${index}`} className="border-b border-white/10 pb-2 last:border-b-0 last:pb-0">
                <p className="font-semibold">
                  {detail.source} - {detail.evaluatorName}
                </p>
                <p className="text-[11px] text-slate-200">{detail.evaluatorGrade || "Collaborateur"}</p>
                {detail.missionTitle ? <p className="mt-1 text-[11px] text-slate-200">{detail.missionTitle}</p> : null}
                <p className="mt-1 font-bold text-[#A7F3D0]">{formatScore(detail.score)}</p>
                {detail.submittedAt ? <p className="text-[11px] text-slate-300">{formatDate(detail.submittedAt)}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Rapportsequipe() {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getManagerTeamReport();

        if (cancelled) return;

        setReportData(response);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement du rapport équipe impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = reportData?.rows || [];
  const kpis = reportData?.kpis || {};
  const cycleLabel = reportData?.cycle_label || "Cycle 2025-2026";
  const finalDecisionCount = rows.filter((row) => getFinalDecisionLabel(row) !== "En attente").length;

  const reportCards = useMemo(
    () => [
      {
        title: "Score mission moyen",
        value: typeof kpis.missionTeamAverage === "number" ? String(kpis.missionTeamAverage) : "--",
        subtitle: "Moyenne des scores mission",
        accent: "",
      },
      {
        title: "Score global moyen",
        value: typeof kpis.globalTeamAverage === "number" ? String(kpis.globalTeamAverage) : "--",
        subtitle: "Moyenne des scores globaux",
        accent: "",
      },
      {
        title: "Taux de complétion",
        value: `${kpis.completionRate || 0}%`,
        subtitle: `${kpis.completedEvaluationsCount || 0}/${kpis.totalMembers || 0} évaluations complétées`,
        accent: "",
      },
      {
        title: "Décisions finales reçues",
        value: String(finalDecisionCount),
        subtitle: `${rows.length || 0} collaborateur(s) suivis`,
        accent: "",
      },
    ],
    [finalDecisionCount, kpis, rows.length]
  );

  const exportsList = [
    {
      title: "Rapport de synthèse d'équipe",
      subtitle: "Scores missions, scores globaux, décisions finales - PDF",
      action: "Export PDF",
      actionClass: "bg-[#1E88F4] text-white",
    },
    {
      title: "Données détaillées de l'équipe",
      subtitle: "Toutes les moyennes consolidées - Excel",
      action: "Export Excel",
      actionClass: "bg-[#EAF1F8] text-[#0F3A63]",
    },
  ];

  const handleExport = (item) => {
    const slug = item.title.toLowerCase().replaceAll(" ", "-").replaceAll("'", "");

    if (item.action.includes("Excel")) {
      downloadFile(`${slug}.csv`, buildCsvReport(rows), "text/csv;charset=utf-8");
      return;
    }

    downloadFile(`${slug}.html`, buildPrintableReport(item.title, rows, cycleLabel), "text/html;charset=utf-8");
  };

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement du reporting équipe...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold text-slate-400">Reporting - {cycleLabel}</p>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((card) => (
          <article key={card.title} className="rounded-lg bg-[#003B63] p-4 text-white shadow-sm">
            <p className="mb-5 text-xs font-semibold">{card.title}</p>
            <p className={`text-xl font-extrabold ${card.accent}`}>{card.value}</p>
            {card.subtitle ? <p className="mt-2 text-xs text-[#D8E6F0]">{card.subtitle}</p> : null}
          </article>
        ))}
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-2xl font-extrabold text-[#0F3A63]">Synthèse des scores par collaborateur</h2>
        <div className="overflow-x-auto rounded-md border border-slate-100">
          <table className="min-w-[860px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#003B63] text-left text-white">
                <th className="px-4 py-3 font-semibold">Collaborateur</th>
                <th className="px-4 py-3 font-semibold">Score missions</th>
                <th className="px-4 py-3 font-semibold">Score globaux</th>
                <th className="px-4 py-3 font-semibold">Décision finale</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 text-[#0F3A63] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-500">
                          {row.initials || "--"}
                        </span>
                        <div>
                          <span className="font-semibold">{row.name}</span>
                          <p className="text-xs text-slate-500">
                            {row.grade} - {row.department}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreWithTooltip score={row.missionScore} details={row.missionScoreDetails} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreWithTooltip score={row.globalScore} details={row.globalScoreDetails} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex min-w-[150px] justify-center rounded-full px-3 py-1 text-xs font-semibold ${getFinalDecisionClass(
                          getFinalDecisionLabel(row)
                        )}`}
                      >
                        {getFinalDecisionLabel(row)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
                    Aucune évaluation manager disponible pour le reporting d'équipe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Survolez un score mission ou global pour voir le détail complet des notes prises dans le calcul.
        </p>
      </section>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold text-[#0F3A63]">Exports disponibles</h2>
        <div className="space-y-2">
          {exportsList.map((item) => (
            <article key={item.title} className="rounded-md bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#79B742]">{item.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F3A63]">{item.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleExport(item)}
                  className={`rounded-md px-5 py-2 text-xs font-semibold ${item.actionClass}`}
                >
                  {item.action}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Rapportsequipe;
