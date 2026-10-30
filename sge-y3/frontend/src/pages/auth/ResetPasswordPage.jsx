import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { resetPassword } from "@/api/auth";
import AuthLayout from "@/pages/auth/AuthLayout";

const inputClassName =
  "h-14 w-full rounded-xl border border-[#9CC86D] bg-transparent px-5 pr-14 text-sm tracking-wide text-[#27415B] outline-none placeholder:text-[#9AA0A6] focus:ring-2 focus:ring-[#76B82A]/30";

function ResetPasswordPage({ token, onDone }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      setErrorMessage("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("La confirmation du nouveau mot de passe ne correspond pas.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const response = await resetPassword({ token, newPassword, confirmPassword });
      // Le backend renvoie une nouvelle session : l'utilisateur est connecté directement.
      onDone?.(response.message || "Mot de passe réinitialisé avec succès.", response.token ? response : null);
    } catch (error) {
      setErrorMessage(error.message || "Réinitialisation impossible pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="NOUVEAU MOT DE PASSE">
      <form className="mx-auto max-w-[400px] space-y-7" onSubmit={handleSubmit}>
        <p className="text-sm leading-6 text-[#27415B]">
          Choisissez un nouveau mot de passe d'au moins 8 caractères.
        </p>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="NOUVEAU MOT DE PASSE"
            autoComplete="new-password"
            required
            className={inputClassName}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#76B82A]"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="CONFIRMER LE MOT DE PASSE"
          autoComplete="new-password"
          required
          className={inputClassName}
        />

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mx-auto block h-14 w-full max-w-[210px] rounded-2xl bg-[#76B82A] text-lg font-bold text-white transition hover:bg-[#6EAD28] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Enregistrement..." : "Valider"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => onDone?.("")}
            className="text-xs font-semibold text-[#0E4A6B] underline-offset-2 hover:underline"
          >
            Retour à la connexion
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
