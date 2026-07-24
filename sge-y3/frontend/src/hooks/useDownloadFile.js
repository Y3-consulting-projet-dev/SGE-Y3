import { useState } from "react";

/**
 * Hook pour télécharger un blob et déclencher le téléchargement navigateur.
 * fetchFn doit retourner { blob, filename }.
 */
export function useDownloadFile() {
  const [downloadingId, setDownloadingId] = useState("");
  const [error, setError] = useState("");

  async function download(id, fetchFn) {
    if (!id) return;
    try {
      setDownloadingId(id);
      setError("");
      const { blob, filename } = await fetchFn();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || "Téléchargement impossible.");
    } finally {
      setDownloadingId("");
    }
  }

  return { downloadingId, error, download };
}
