import { useEffect, useMemo, useState } from "react";
import { getManagerTeamReport } from "@/lib/managerOverview";

const recommendationOptions = ["Maintien", "Augmentation"];

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

function getRecommendationClass(recommendation) {
  return recommendation === "Augmentation"
    ? "bg-[#DFECD4] text-[#73AF2E]"
    : "bg-[#F5DFC2] text-[#D48A2A]";
}

function buildCsvReport(rows, sectionTitles, selectedRecommendations) {
  const header = ["Collaborateur", ...sectionTitles, "Score final", "Recommandation"];
  const values = rows.map((row) => [
    row.name,
    ...row.sectionScores.map((section) => formatScore(section.score)),
    formatScore(row.finalScore),
    selectedRecommendations[row.id] || row.automaticRecommendation,
  ]);

  return [header, ...values].map((line) => line.map((cell) => `"${cell}"`).join(";")).join("\n");
}

function buildPrintableReport(title, rows, sectionTitles, selectedRecommendations, cycleLabel) {
  const headerCells = [...sectionTitles, "Score final", "Recommandation"]
    .map((label) => `<th>${label}</th>`)
    .join("");

  const bodyRows = rows
    .map(
      (row) => `
        <tr>
          <td>${row.name}</td>
          ${row.sectionScores.map((section) => `<td>${formatScore(section.score)}</td>`).join("")}
          <td>${formatScore(row.finalScore)}</td>
          <td>${selectedRecommendations[row.id] || row.automaticRecommendation}</td>
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
    <p>Reporting d'equipe - ${cycleLabel}</p>
    <table>
      <thead>
        <tr>
          <th>Collaborateur</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`;
}

function Rapportsequipe() {
  const [reportData, setReportData] = useState(null);
  const [selectedRecommendations, setSelectedRecommendations] = useState({});
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
        setSelectedRecommendations(
          Object.fromEntries((response.rows || []).map((row) => [row.id, row.automaticRecommendation]))
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement du rapport equipe impossible.");
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
  const sectionTitles = reportData?.section_titles || [];
  const kpis = reportData?.kpis || {};
  const cycleLabel = reportData?.cycle_label || "Cycle 2025-2026";

  const reportCards = useMemo(
    () => [
      {
        title: "Score moyen de l'equipe",
        value: typeof kpis.teamAverage === "number" ? String(kpis.teamAverage) : "--",
        subtitle: "Sur 5",
        accent: "",
      },
      {
        title: "Taux completion",
        value: `${kpis.completionRate || 0}%`,
        subtitle: `${kpis.completedEvaluationsCount || 0}/${kpis.totalMembers || 0} eval(s) completes`,
        accent: "",
      },
      {
        title: "Ecarts signales",
        value: String(kpis.unjustifiedGapCount || 0),
        subtitle: "A justifier",
        accent: "text-[#F34D4D]",
      },
      {
        title: "Augmentations recommandees",
        value: String(kpis.augmentationCount || 0),
        subtitle: "",
        accent: "",
      },
    ],
    [kpis]
  );

  const exportsList = [
    {
      title: "Rapport de synthese d'equipe",
      subtitle: "Scores, recommandations, sections - PDF",
      action: "Export PDF",
      actionClass: "bg-[#1E88F4] text-white",
    },
    {
      title: "Donnees detaillees de l'equipe",
      subtitle: "Toutes les notes consolidees - Excel",
      action: "Export Excel",
      actionClass: "bg-[#EAF1F8] text-[#0F3A63]",
    },
  ];

  const handleExport = (item) => {
    const slug = item.title.toLowerCase().replaceAll(" ", "-").replaceAll("'", "");

    if (item.action.includes("Excel")) {
      downloadFile(
        `${slug}.csv`,
        buildCsvReport(rows, sectionTitles, selectedRecommendations),
        "text/csv;charset=utf-8"
      );
      return;
    }

    downloadFile(
      `${slug}.html`,
      buildPrintableReport(item.title, rows, sectionTitles, selectedRecommendations, cycleLabel),
      "text/html;charset=utf-8"
    );
  };

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement du reporting equipe...</section>;
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
        <h2 className="mb-3 text-2xl font-extrabold text-[#0F3A63]">Synthese des scores par collaborateur</h2>
        <div className="overflow-x-auto rounded-md border border-slate-100">
          <table className="min-w-[860px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#003B63] text-left text-white">
                <th className="px-4 py-3 font-semibold">Collaborateur</th>
                {sectionTitles.map((title) => (
                  <th key={title} className="px-4 py-3 font-semibold">
                    {title}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Score final</th>
                <th className="px-4 py-3 font-semibold">Recommandation</th>
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
                    {row.sectionScores.map((section) => (
                      <td
                        key={`${row.id}-${section.title}`}
                        className={`px-4 py-3 font-semibold ${
                          typeof section.score === "number" && section.score < 3
                            ? "text-[#F34D4D]"
                            : typeof section.score === "number" && section.score < 4
                              ? "text-[#D48A2A]"
                              : "text-[#73AF2E]"
                        }`}
                      >
                        {formatScore(section.score)}
                      </td>
                    ))}
                    <td className="px-4 py-3 font-bold">{formatScore(row.finalScore)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={selectedRecommendations[row.id] || row.automaticRecommendation}
                        onChange={(event) =>
                          setSelectedRecommendations((current) => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                        className={`min-w-[150px] rounded-full px-3 py-1 text-xs font-semibold outline-none ${getRecommendationClass(
                          selectedRecommendations[row.id] || row.automaticRecommendation
                        )}`}
                      >
                        {recommendationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={sectionTitles.length + 3} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
                    Aucune evaluation manager disponible pour le reporting d'equipe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
