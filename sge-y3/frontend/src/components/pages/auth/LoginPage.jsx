import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import logo1Img from "@/assets/logo1.png";

function LoginPage({ onLoginSuccess }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#F3F3F3]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="relative overflow-hidden bg-[#004267] px-8 py-14 text-white md:px-16">
          <div className="pointer-events-none absolute -left-12 top-8 h-28 w-28 rotate-45 rounded-xl bg-white/10" />
          <div className="pointer-events-none absolute -left-16 top-36 h-32 w-32 rotate-45 rounded-xl bg-white/10" />

          <div className="mx-auto flex h-full w-full max-w-[420px] flex-col justify-center">
            <p className="mb-8 max-w-[360px] text-lg font-medium leading-7 tracking-wide text-white/95">
              Bienvenue sur le Système de Gestion des Évaluations
            </p>

            <img
                  src={logo1Img}
                  alt="Logo Y3"
              className="mb-10 w-[280px] object-contain"
            />

            <p className="max-w-[380px] text-2xl leading-8 text-white/95">
              Accédez à votre espace pour réaliser, suivre et consulter vos évaluations en toute simplicité
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-8 py-14 md:px-16">
          <div className="w-full max-w-[460px]">
            <h1 className="mb-16 text-center text-4xl font-extrabold tracking-wide text-[#76B82A]">
              CONNEXION
            </h1>

            <form className="mx-auto max-w-[400px] space-y-7" onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="EMAIL"
                required
                className="h-14 w-full rounded-xl border border-[#9CC86D] bg-transparent px-5 text-sm tracking-wide text-[#27415B] outline-none placeholder:text-[#9AA0A6] focus:ring-2 focus:ring-[#76B82A]/30"
              />

              <div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="MOT DE PASSE"
                    required
                    className="h-14 w-full rounded-xl border border-[#9CC86D] bg-transparent px-5 pr-14 text-sm tracking-wide text-[#27415B] outline-none placeholder:text-[#9AA0A6] focus:ring-2 focus:ring-[#76B82A]/30"
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
                <p className="mt-2 text-right text-xs font-semibold text-[#0E4A6B]">Mot de passe oublié ?</p>
              </div>

              {errorMessage ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mx-auto block h-14 w-full max-w-[210px] rounded-2xl bg-[#76B82A] text-lg font-bold text-white transition hover:bg-[#6EAD28] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Connexion..." : "Se Connecter"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LoginPage;
