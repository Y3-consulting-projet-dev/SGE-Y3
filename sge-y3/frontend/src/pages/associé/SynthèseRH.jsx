import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { getAssociateSyntheses } from "@/api/associateOverview";

function formatScore(score) {
  return typeof score === "number" ? `${score.toFixed(1)}/5` : "--";
}

function getScoreTone(score) {
  if (typeof score !== "number") return "text-[#0F3A63]";
  if (score >= 4) return "text-[#78B843]";
  if (score < 3) return "text-[#C53B3B]";
  return "text-[#0F3A63]";
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("fr-FR");
}

function EvaluationTrail({ items }) {
  return (
    <section className="rounded-lg bg-[#F8FAFC] p-4">
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Détail complet de l'évaluation</h3>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div key={`${item.source}-${item.evaluatorName}-${index}`} className="rounded-lg bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-[#0F3A63]">
                    {item.source} - {item.evaluatorName}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">{item.evaluatorGrade}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${getScoreTone(item.overallScore)}`}>{formatScore(item.overallScore)}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatDate(item.submittedAt)}</p>
                </div>
              </div>

              {(item.sectionScores || []).length ? (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {item.sectionScores.map((section) => (
                    <div key={`${item.source}-${section.sectionId}`} className="flex items-center justify-between text-sm font-semibold text-[#0F3A63]">
                      <span>{section.title}</span>
                      <span className={getScoreTone(section.score)}>{formatScore(section.score)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {(item.sectionComments || []).length ? (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {item.sectionComments.map((section) => (
                    <div key={`${item.source}-comment-${section.sectionId}`} className="rounded-lg bg-[#F8FAFC] p-3">
                      <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{section.comment}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {(item.titleJustifications || []).length ? (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {item.titleJustifications.map((title) => (
                    <div key={`${item.source}-gap-${title.pageId}`} className="rounded-lg bg-[#FFF7ED] p-3">
                      <p className="text-xs font-bold text-[#0F3A63]">{title.sectionTitle}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{title.pageTitle}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{title.comment}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-slate-500">Aucun détail d'évaluation disponible pour cette synthèse.</p>
      )}
    </section>
  );
}

function ScoreBreakdown({ title, details }) {
  return (
    <section className="rounded-lg bg-[#F8FAFC] p-4">
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">{title}</h3>
      {details.length ? (
        <div className="mt-3 space-y-3">
          {details.map((detail, index) => (
            <div key={`${detail.source}-${detail.evaluatorName}-${detail.missionTitle}-${index}`} className="rounded-lg bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-[#0F3A63]">
                    {detail.source} - {detail.evaluatorName}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">{detail.evaluatorGrade}</p>
                  {detail.missionTitle ? <p className="mt-1 text-sm font-semibold text-[#1E5580]">{detail.missionTitle}</p> : null}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${getScoreTone(detail.score)}`}>{formatScore(detail.score)}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatDate(detail.submittedAt)}</p>
                </div>
              </div>
              {(detail.sectionComments || []).length ? (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {detail.sectionComments.map((section) => (
                    <div key={`${detail.source}-${detail.missionTitle}-comment-${section.sectionId}`} className="rounded-lg bg-[#F8FAFC] p-3">
                      <p className="text-xs font-bold text-[#0F3A63]">{section.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{section.comment}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {(detail.titleJustifications || []).length ? (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {detail.titleJustifications.map((title) => (
                    <div key={`${detail.source}-${detail.missionTitle}-gap-${title.pageId}`} className="rounded-lg bg-[#FFF7ED] p-3">
                      <p className="text-xs font-bold text-[#0F3A63]">{title.sectionTitle}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{title.pageTitle}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{title.comment}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-slate-500">Aucun détail disponible pour ce score.</p>
      )}
    </section>
  );
}

function SyntheseRH() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [gradeFilter, setGradeFilter] = useState("Tous les grades");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSyntheses() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getAssociateSyntheses();

        if (!cancelled) {
          setData(response);
          const firstId = response?.items?.[0]?.id || "";
          setSelectedId(firstId);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des synthèses RH impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSyntheses();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.items || [];
  const gradeOptions = useMemo(() => {
    const uniqueGrades = Array.from(new Set(rows.map((row) => row.grade).filter(Boolean)));
    return ["Tous les grades", ...uniqueGrades];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => gradeFilter === "Tous les grades" || row.grade === gradeFilter);
  }, [gradeFilter, rows]);

  const selectedRow = filteredRows.find((row) => row.id === selectedId) || filteredRows[0] || null;

  useEffect(() => {
    if (!filteredRows.length) {
      if (selectedId) setSelectedId("");
      return;
    }

    if (!filteredRows.some((row) => row.id === selectedId)) {
      setSelectedId(filteredRows[0].id);
    }
  }, [filteredRows, selectedId]);

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des synthèses RH...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">Synthèses validées RH</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => window.alert("Notifications bientôt disponibles.")} className="rounded-full p-2 text-slate-500 hover:bg-slate-200/70">
            <Bell size={16} />
          </button>
          <button onClick={() => window.print()} className="rounded-full bg-[#7EB83E] px-4 py-2 text-xs font-bold text-white hover:bg-[#73AB39]">
            Exporter les synthèses
          </button>
        </div>
      </header>

      <section className="rounded-md border-l-4 border-[#6FB33E] bg-[#DDECD8] px-4 py-3 text-sm font-semibold text-[#204B2E]">
        Seules les synthèses transmises par la RH sont visibles ici. Cliquez sur une ligne pour consulter le détail complet des scores.
      </section>

      <section className="rounded-xl bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <select
            value={gradeFilter}
            onChange={(event) => setGradeFilter(event.target.value)}
            className="h-9 rounded-lg border border-[#0C4B6C] bg-white px-3 text-xs font-bold text-[#0C4B6C] outline-none transition hover:bg-[#0C4B6C] hover:text-white focus:bg-[#0C4B6C] focus:text-white"
          >
            {gradeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse">
            <thead>
              <tr className="bg-[#0C4B6C] text-left text-xs font-semibold text-white">
                <th className="px-3 py-3">Collaborateur</th>
                <th className="px-3 py-3">Grade</th>
                <th className="px-3 py-3">Évaluateur</th>
                <th className="px-3 py-3">Score mission(s)</th>
                <th className="px-3 py-3">Score globaux</th>
                <th className="px-3 py-3">Score final</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const isActive = selectedRow?.id === row.id;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`cursor-pointer border-b border-slate-100 text-sm text-[#0F3A63] last:border-0 ${isActive ? "bg-[#F4F8FC]" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                            {row.initials}
                          </span>
                          <div>
                            <p className="font-extrabold">{row.name}</p>
                            <p className="text-xs font-semibold text-slate-500">{row.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-md bg-[#DEE8F3] px-2 py-1 text-xs font-semibold text-[#356082]">{row.grade}</span>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold">{row.managerName}</td>
                      <td className={`px-3 py-3 text-xs font-bold ${getScoreTone(row.missionScore)}`}>{formatScore(row.missionScore)}</td>
                      <td className={`px-3 py-3 text-xs font-bold ${getScoreTone(row.scoreGlobal)}`}>{formatScore(row.scoreGlobal)}</td>
                      <td className={`px-3 py-3 text-xs font-black ${getScoreTone(row.finalScore)}`}>{formatScore(row.finalScore)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
                    Aucune synthèse transmise à l'associé pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRow ? (
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Détail de la synthèse</p>
              <h2 className="mt-1 text-3xl font-black text-[#0F3A63]">{selectedRow.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {selectedRow.grade} - {selectedRow.department}
              </p>
            </div>
            <span className="rounded-full bg-[#EEF5E2] px-4 py-2 text-sm font-extrabold text-[#78B843]">{formatScore(selectedRow.finalScore)}</span>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="rounded-lg bg-[#F8FAFC] p-4">
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Score mission(s)</p>
              <p className={`mt-3 text-3xl font-black ${getScoreTone(selectedRow.missionScore)}`}>{formatScore(selectedRow.missionScore)}</p>
            </article>
            <article className="rounded-lg bg-[#F8FAFC] p-4">
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Score globaux</p>
              <p className={`mt-3 text-3xl font-black ${getScoreTone(selectedRow.scoreGlobal)}`}>{formatScore(selectedRow.scoreGlobal)}</p>
            </article>
            <article className="rounded-lg bg-[#F8FAFC] p-4">
              <p className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Score final</p>
              <p className={`mt-3 text-3xl font-black ${getScoreTone(selectedRow.finalScore)}`}>{formatScore(selectedRow.finalScore)}</p>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ScoreBreakdown title="Détail des scores mission(s)" details={selectedRow.missionScoreDetails || []} />
            <ScoreBreakdown title="Détail des scores globaux" details={selectedRow.globalScoreDetails || []} />
          </div>

          <div className="mt-5">
            <EvaluationTrail items={selectedRow.evaluationTrail || []} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default SyntheseRH;
