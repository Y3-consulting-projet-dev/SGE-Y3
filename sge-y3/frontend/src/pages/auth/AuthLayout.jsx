import logo1Img from "@/assets/logo1.png";

function AuthLayout({ title, children }) {
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
              {title}
            </h1>

            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AuthLayout;
