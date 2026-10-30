import { useEffect, useRef, useState } from "react";
import { confirmRecoveryCode, createRecoveryCode } from "@/api/auth";
import AuthLayout from "@/pages/auth/AuthLayout";
import RecoveryCodePanel from "@/pages/auth/RecoveryCodePanel";

// Écran obligatoire : première connexion, compte sans code, ou juste après une réinitialisation.
function RecoveryCodePage({ onDone, onLogout }) {
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // StrictMode exécute les effets deux fois : un seul code doit être généré (sinon le premier serait invalidé).
  const hasRequestedCode = useRef(false);

  useEffect(() => {
    if (hasRequestedCode.current) return;
    hasRequestedCode.current = true;

    createRecoveryCode()
      .then(setRecoveryCode)
      .catch((error) => setLoadError(error.message || "Génération du code impossible pour le moment."));
  }, []);

  const handleContinue = async () => {
    try {
      setIsSubmitting(true);
      setConfirmError("");
      const session = await confirmRecoveryCode();
      onDone?.(session);
    } catch (error) {
      setConfirmError(error.message || "Enregistrement impossible pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="VOTRE CODE DE SECOURS">
      <div className="mx-auto max-w-[420px]">
        {recoveryCode ? (
          <RecoveryCodePanel
            code={recoveryCode.code}
            email={recoveryCode.email}
            createdAt={recoveryCode.createdAt}
            onContinue={handleContinue}
            isSubmitting={isSubmitting}
            errorMessage={confirmError}
          />
        ) : loadError ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
            <button type="button" onClick={() => window.location.reload()} className="text-sm font-semibold text-[#0E4A6B] underline">
              Réessayer
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-[#5F6B7A]">Génération de votre code...</p>
        )}

        <div className="mt-6 text-center">
          <button type="button" onClick={onLogout} className="text-xs font-semibold text-[#0E4A6B] underline underline-offset-2">
            Se déconnecter
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

export default RecoveryCodePage;
