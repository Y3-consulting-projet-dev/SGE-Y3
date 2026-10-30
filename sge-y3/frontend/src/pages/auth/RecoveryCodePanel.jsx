import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Repli pour les contextes non sécurisés (http sur une adresse IP du réseau local).
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function downloadRecoveryCode({ code, email, createdAt }) {
  const content = [
    "Code de secours SGE - Ycube AC",
    "",
    `Compte : ${email}`,
    `Code de secours : ${code}`,
    `Généré le : ${formatDate(createdAt)}`,
    "",
    "Conservez ce code en lieu sûr. Il permet de choisir un nouveau mot de passe en cas d'oubli.",
    "Il ne peut servir qu'une seule fois ; un nouveau code vous sera alors attribué.",
    "",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "code-de-secours-sge.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Affichage unique du code de secours : l'utilisateur doit confirmer l'avoir conservé pour continuer.
function RecoveryCodePanel({ code, email, createdAt, onContinue, isSubmitting = false, errorMessage = "" }) {
  const [isSaved, setIsSaved] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const handleCopy = async () => {
    try {
      await copyText(code);
      setCopyStatus("Code copié.");
    } catch {
      setCopyStatus("Copie impossible : recopiez le code manuellement.");
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-[#27415B]">
        Ce code vous permettra de choisir un nouveau mot de passe si vous oubliez le vôtre. Il ne sera{" "}
        <strong>affiché qu'une seule fois</strong> : conservez-le en lieu sûr (gestionnaire de mots de passe, fichier
        personnel, papier rangé).
      </p>

      <div className="rounded-xl border-2 border-dashed border-[#9CC86D] bg-white px-4 py-3 text-center">
        <p className="select-all font-mono text-base font-bold tracking-[0.08em] text-[#0F3A63] sm:text-lg">{code}</p>
        <p className="mt-2 text-xs text-[#5F6B7A]">Compte : {email}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-xl border border-[#9CC86D] px-4 py-2 text-sm font-semibold text-[#0E4A6B] hover:bg-[#F1F8E9]"
        >
          <Copy size={16} /> Copier
        </button>
        <button
          type="button"
          onClick={() => downloadRecoveryCode({ code, email, createdAt })}
          className="inline-flex items-center gap-2 rounded-xl border border-[#9CC86D] px-4 py-2 text-sm font-semibold text-[#0E4A6B] hover:bg-[#F1F8E9]"
        >
          <Download size={16} /> Télécharger
        </button>
      </div>
      {copyStatus ? <p className="text-center text-xs text-[#4E8B1B]">{copyStatus}</p> : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F7F9FB] px-4 py-3 text-sm text-[#27415B]">
        <input
          type="checkbox"
          checked={isSaved}
          onChange={(event) => setIsSaved(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#76B82A]"
        />
        J'ai conservé mon code en lieu sûr
      </label>

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        disabled={!isSaved || isSubmitting}
        className="mx-auto flex h-14 w-full max-w-[210px] items-center justify-center gap-2 rounded-2xl bg-[#76B82A] text-lg font-bold text-white transition hover:bg-[#6EAD28] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check size={18} /> {isSubmitting ? "Enregistrement..." : "Continuer"}
      </button>
    </div>
  );
}

export default RecoveryCodePanel;
