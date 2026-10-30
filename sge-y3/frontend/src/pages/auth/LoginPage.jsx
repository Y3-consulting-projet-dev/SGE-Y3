import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { requestPasswordReset } from "@/api/auth";
import AuthLayout from "@/pages/auth/AuthLayout";

const inputClassName =
  "h-14 w-full rounded-xl border border-[#9CC86D] bg-transparent px-5 text-sm tracking-wide text-[#27415B] outline-none placeholder:text-[#9AA0A6] focus:ring-2 focus:ring-[#76B82A]/30";
const submitClassName =
  "mx-auto block h-14 w-full max-w-[210px] rounded-2xl bg-[#76B82A] text-lg font-bold text-white transition hover:bg-[#6EAD28] disabled:cursor-not-allowed disabled:opacity-70";
const linkClassName =
  "cursor-pointer text-xs font-semibold text-[#0E4A6B] underline underline-offset-2 hover:text-[#76B82A]";

function ForgotPasswordForm({ initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setErrorMessage("Veuillez renseigner votre email.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const response = await requestPasswordReset(email.trim());
      setSuccessMessage(response.message || "Si un compte correspond à cet email, un lien vient de vous être envoyé.");
    } catch (error) {
      setErrorMessage(error.message || "Envoi du lien impossible pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mx-auto max-w-[400px] space-y-7" onSubmit={handleSubmit}>
      <p className="text-sm leading-6 text-[#27415B]">
        Saisissez l'email de votre compte. Vous recevrez un lien pour choisir un nouveau mot de passe.
      </p>

      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="EMAIL"
        required
        disabled={Boolean(successMessage)}
        className={inputClassName}
      />

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {successMessage ? (
        <p className="rounded-xl border border-[#9CC86D] bg-[#F1F8E9] px-4 py-3 text-sm text-[#27415B]">{successMessage}</p>
      ) : (
        <button type="submit" disabled={isSubmitting} className={submitClassName}>
          {isSubmitting ? "Envoi..." : "Envoyer le lien"}
        </button>
      )}

      <div className="text-center">
        <button type="button" onClick={onBack} className={linkClassName}>
          Retour à la connexion
        </button>
      </div>
    </form>
  );
}

function LoginPage({ onLoginSuccess, initialMessage = "" }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await onLoginSuccess?.({
        email: email.trim(),
        password,
      });
    } catch (error) {
      setErrorMessage(error.message || "Connexion impossible pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isForgotPassword) {
    return (
      <AuthLayout title="MOT DE PASSE OUBLIÉ">
        <ForgotPasswordForm initialEmail={email} onBack={() => setIsForgotPassword(false)} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="CONNEXION">
      <form className="mx-auto max-w-[400px] space-y-7" onSubmit={handleSubmit}>
        {infoMessage ? (
          <p className="rounded-xl border border-[#9CC86D] bg-[#F1F8E9] px-4 py-3 text-sm text-[#27415B]">{infoMessage}</p>
        ) : null}

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="EMAIL"
          required
          className={inputClassName}
        />

        <div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="MOT DE PASSE"
              required
              className={`${inputClassName} pr-14`}
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
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => {
                setInfoMessage("");
                setErrorMessage("");
                setIsForgotPassword(true);
              }}
              className={linkClassName}
            >
              Mot de passe oublié ?
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button type="submit" disabled={isSubmitting} className={submitClassName}>
          {isSubmitting ? "Connexion..." : "Se Connecter"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
