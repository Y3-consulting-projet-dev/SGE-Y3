import { useEffect, useState } from "react";
import { downloadRhReport, getRhReports } from "@/lib/rhOverview";

function RapportsRH({ readOnly = false }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhReports();
        if (!cancelled) {
          setData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des rapports RH impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadReports();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.exports || [];

  async function handleDownload(row) {
    if (!row?.id || readOnly) return;

    try {
      setDownloadingId(row.id);
      setErrorMessage("");
      const { blob, filename } = await downloadRhReport(row.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error.message || "Telechargement impossible.");
    } finally {
      setDownloadingId("");
    }
  }

  async function handleDownloadAll() {
    if (readOnly || !rows.length) return;

    try {
      setIsDownloadingAll(true);
      setErrorMessage("");

      for (const row of rows) {
        await handleDownload(row);
      }
    } finally {
      setIsDownloadingAll(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des rapports RH...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Rapports RH</h2>
          <p className="text-sm font-semibold text-slate-500">Exports et documents du cycle d'evaluation.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={readOnly || !rows.length || isDownloadingAll || Boolean(downloadingId)}
          className={`rounded-full px-4 py-2 text-xs font-bold ${
            readOnly || !rows.length || isDownloadingAll || downloadingId ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-[#8BC53F] text-white"
          }`}
        >
          {readOnly ? "Lecture seule" : isDownloadingAll ? "Generation..." : "Generer export"}
        </button>
      </div>

      <div className="space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <article key={row.title} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] p-4">
              <div>
                <p className="text-sm font-extrabold text-[#0F3A63]">{row.title}</p>
                <p className="text-xs font-semibold text-slate-500">Proprietaire: {row.owner}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F4A72]">{row.format}</span>
                <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-bold text-slate-600">{row.status}</span>
                <button
                  type="button"
                  onClick={() => handleDownload(row)}
                  disabled={readOnly || downloadingId === row.id || isDownloadingAll}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    readOnly || downloadingId === row.id || isDownloadingAll
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "bg-[#0D496A] text-white"
                  }`}
                >
                  {downloadingId === row.id ? "Telechargement..." : "Telecharger"}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Aucun rapport RH disponible.
          </div>
        )}
      </div>
    </section>
  );
}

export default RapportsRH;
