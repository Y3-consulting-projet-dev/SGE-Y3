import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { downloadRhReport, getRhReports } from "@/lib/rhOverview";

function FormatToggle({ rowId, formats, selected, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {formats.map((fmt) => (
        <button
          key={fmt}
          type="button"
          onClick={() => onChange(rowId, fmt)}
          disabled={disabled}
          className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
            selected === fmt
              ? "bg-white text-[#0D496A] shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {fmt}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "Pret")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Prêt
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      {status}
    </span>
  );
}

function RapportsRH({ readOnly = false }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhReports();
        if (!cancelled) {
          setData(response);
          const defaults = {};
          (response?.exports || []).forEach((row) => {
            defaults[row.id] = row.format || (row.availableFormats?.[0] ?? "PDF");
          });
          setSelectedFormats(defaults);
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
    return () => { cancelled = true; };
  }, []);

  const rows = data?.exports || [];

  function handleFormatChange(rowId, fmt) {
    setSelectedFormats((prev) => ({ ...prev, [rowId]: fmt }));
  }

  async function handleDownload(row) {
    if (!row?.id || readOnly) return;
    try {
      setDownloadingId(row.id);
      setErrorMessage("");
      const format = selectedFormats[row.id] || row.format || "";
      const { blob, filename } = await downloadRhReport(row.id, format);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error.message || "Téléchargement impossible.");
    } finally {
      setDownloadingId("");
    }
  }

  async function handleDownloadAll() {
    if (readOnly || !rows.length) return;
    try {
      setIsDownloadingAll(true);
      setErrorMessage("");
      for (const row of rows) await handleDownload(row);
    } finally {
      setIsDownloadingAll(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement des rapports RH...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
        {errorMessage}
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F3A63]">Rapports RH</h2>
          <p className="text-sm font-medium text-slate-400">
            Exports et documents du cycle d'évaluation.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={readOnly || !rows.length || isDownloadingAll || Boolean(downloadingId)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
            readOnly || !rows.length || isDownloadingAll || downloadingId
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-[#8BC53F] text-white hover:bg-[#7ab535]"
          }`}
        >
          <Download size={13} />
          {readOnly ? "Lecture seule" : isDownloadingAll ? "Génération..." : "Tout télécharger"}
        </button>
      </div>

      {/* Table */}
      {rows.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-6 py-3 text-left">Document</th>
              <th className="px-4 py-3 text-left">Format</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const activeFormat = selectedFormats[row.id] || row.format;
              const isDownloading = downloadingId === row.id;
              const isBusy = isDownloading || isDownloadingAll;
              const Icon = activeFormat === "CSV" ? FileSpreadsheet : FileText;

              return (
                <tr key={row.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FB]">
                        <Icon size={16} className="text-[#0D496A]" />
                      </div>
                      <div>
                        <p className="font-bold text-[#0F3A63]">{row.title}</p>
                        <p className="text-xs text-slate-400">{row.owner}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <FormatToggle
                      rowId={row.id}
                      formats={row.availableFormats || [row.format]}
                      selected={activeFormat}
                      onChange={handleFormatChange}
                      disabled={readOnly || isBusy}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownload(row)}
                      disabled={readOnly || isBusy}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                        readOnly || isBusy
                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                          : "bg-[#0D496A] text-white hover:bg-[#0a3a55]"
                      }`}
                    >
                      <Download size={12} />
                      {isDownloading ? "En cours..." : "Télécharger"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
          Aucun rapport RH disponible.
        </div>
      )}
    </section>
  );
}

export default RapportsRH;
