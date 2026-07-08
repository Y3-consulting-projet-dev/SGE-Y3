import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useDownloadFile } from "@/hooks/useDownloadFile";
import { useRhReports } from "@/hooks/useRhReports";
import { downloadRhReport } from "@/api/rhOverview";

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
  const { rows, isLoading, error, getActiveFormat, setFormat } = useRhReports();
  const { downloadingId, error: downloadError, download } = useDownloadFile();

  const displayError = error || downloadError;

  async function handleDownload(row) {
    if (readOnly) return;
    const format = getActiveFormat(row);
    await download(row.id, () => downloadRhReport(row.id, format));
  }

  async function handleDownloadAll() {
    if (readOnly || !rows.length) return;
    for (const row of rows) await handleDownload(row);
  }

  if (isLoading) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement des rapports RH...
      </section>
    );
  }

  if (displayError) {
    return (
      <section className="rounded-xl bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">
        {displayError}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
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
          disabled={readOnly || !rows.length || Boolean(downloadingId)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
            readOnly || !rows.length || downloadingId
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-[#8BC53F] text-white hover:bg-[#7ab535]"
          }`}
        >
          <Download size={13} />
          {readOnly ? "Lecture seule" : downloadingId ? "Génération..." : "Tout télécharger"}
        </button>
      </div>

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
              const activeFormat = getActiveFormat(row);
              const isDownloading = downloadingId === row.id;
              const isBusy = isDownloading || Boolean(downloadingId);
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
                      onChange={setFormat}
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
