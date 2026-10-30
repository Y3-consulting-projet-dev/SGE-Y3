import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { getAuthConfig, regenerateRecoveryCode } from "@/api/auth";
import RecoveryCodePanel from "@/pages/auth/RecoveryCodePanel";

// Régénération volontaire du code de secours, confirmée par le mot de passe actuel.
function RecoveryCodeSection() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCode, setNewCode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((config) => !cancelled && setIsAvailable(config.passwordResetMode === "recovery_code"))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAvailable) {
    return null;
  }

  const cancel = () => {
    setIsConfirming(false);
    setCurrentPassword("");
    setStatus("");
  };

  const handleRegenerate = async () => {
    if (!currentPassword) {
      setStatus("Veuillez saisir votre mot de passe actuel.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus("");
      const result = await regenerateRecoveryCode(currentPassword);
      setNewCode(result);
      setIsConfirming(false);
      setCurrentPassword("");
    } catch (error) {
      setStatus(error.message || "Génération du code impossible pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mt-6 rounded-[22px] border border-[#E5ECF4] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-semibold text-[#071B49]">Code de secours</h3>
          <p className="mt-1.5 max-w-4xl text-base text-[#6882A4]">
            Il permet de choisir un nouveau mot de passe en cas d'oubli. Générer un nouveau code rend l'ancien
            immédiatement inutilisable.
          </p>
        </div>
        {!isConfirming ? (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#6DAC55] px-5 py-2.5 text-base font-semibold text-[#3F7A2A] hover:bg-[#F2F7ED]"
          >
            <KeyRound size={18} /> Générer un nouveau code de secours
          </button>
        ) : null}
      </div>

      {isConfirming ? (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block min-w-[260px] flex-1">
            <span className="mb-2 block text-base text-[#3E5C81]">Confirmez avec votre mot de passe actuel</span>
            <div className="flex h-12 items-center rounded-[20px] border border-[#D6E1EF] bg-[#F8FBFF] px-4">
              <input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setStatus("");
                }}
                onKeyDown={(event) => event.key === "Enter" && handleRegenerate()}
                placeholder="Mot de passe actuel"
                autoComplete="current-password"
                className="w-full bg-transparent text-lg text-[#071B49] outline-none"
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-[#5B8D3E]">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          <button type="button" onClick={cancel} className="rounded-full border border-[#D6E1EF] px-6 py-2.5 text-base text-[#16335A]">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isSubmitting}
            className="rounded-full bg-[#6DAC55] px-6 py-2.5 text-base font-semibold text-white disabled:opacity-70"
          >
            {isSubmitting ? "Génération..." : "Générer"}
          </button>
        </div>
      ) : null}

      {status ? <p className="mt-3 text-sm font-semibold text-red-600">{status}</p> : null}

      {newCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071B49]/50 px-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[22px] bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-center text-2xl font-extrabold tracking-wide text-[#76B82A]">VOTRE NOUVEAU CODE DE SECOURS</h3>
            <RecoveryCodePanel
              code={newCode.code}
              email={newCode.email}
              createdAt={newCode.createdAt}
              onContinue={() => setNewCode(null)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default RecoveryCodeSection;
