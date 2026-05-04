import { CheckCircle2 } from "lucide-react";

const sectionOneItems = [
  { label: "Animation d'equipe", value: "4/5" },
  { label: "Gestion des conflits", value: "3/5" },
  { label: "Developpement des talents", value: "4/5" },
];

function ScoreSelector({ values, selected }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200">
      {values.map((item) => (
        <button
          key={item}
          className={`h-8 w-8 border-r border-slate-200 text-xs font-semibold last:border-r-0 ${
            item === selected ? "bg-[#003B63] text-white" : "bg-slate-100 text-[#0F3A63]"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function CriteriaRow({ label, selected, progress, locked = false }) {
  const filledBars = locked ? 0 : Math.max(0, Math.min(5, Math.round((progress / 100) * 5)));

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[#0F3A63]">{label}</p>
      <div className="space-y-2">
        <ScoreSelector values={[1, 2, 3, 4, 5]} selected={selected} />
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={`h-[3px] w-14 rounded-full ${index < filledBars ? "bg-[#79B742]" : "bg-slate-300"}`}
            />
          ))}
          <span className={`text-xs font-semibold ${locked ? "text-slate-400" : "text-[#79B742]"}`}>
            {locked ? "--%" : `${progress}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

function Monautoevaluation() {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-400">Axelle Armani - Manager - Cycle 2026</p>

      <div className="rounded-sm bg-[#DCECCB] px-4 py-3 text-xs font-semibold text-[#1E5B34]">
        Cette auto-evaluation sera transmise a l'Associe apres validation RH. Soyez precis et factuel.
      </div>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-[#0F3A63]">Progression - Section 2 / 4</p>
          <span className="text-xs font-semibold text-[#E53935]">En cours</span>
        </div>
        <div className="h-2 rounded-full bg-slate-300">
          <div className="h-2 w-3/5 rounded-full bg-[#2AA7D6]" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-6">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-[#79B742]">Section 1 - Leadership & management</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#DFECD4] px-3 py-1 text-[11px] font-semibold text-[#79B742]">
                <CheckCircle2 size={12} />
                Complete
              </span>
            </div>

            <div className="space-y-2">
              {sectionOneItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs font-semibold text-[#0F3A63]">
                  <p>{item.label}</p>
                  <span className="text-[#79B742]">{item.value}</span>
                </div>
              ))}
            </div>

            <button className="mt-3 text-xs font-semibold text-[#2C89C8] hover:underline">Modifier</button>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-[#79B742]">Section 2 - Pilotage & performance</h2>
              <span className="text-xs font-semibold text-[#E53935]">En cours</span>
            </div>

            <div className="space-y-2 text-xs font-semibold text-[#0F3A63]">
              <div className="flex items-center justify-between">
                <p>Respect des delais de livraison</p>
                <span>--</span>
              </div>
              <div className="flex items-center justify-between">
                <p>Qualite des rapports produits</p>
                <span>--</span>
              </div>
              <div className="flex items-center justify-between">
                <p>Gestion du portefeuille clients</p>
                <span>--</span>
              </div>
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-[#79B742]">Section 3 - Competences techniques</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">A faire</span>
            </div>
            <p className="text-xs font-semibold text-[#0F3A63]">A completer apres la section en cours.</p>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-[#79B742]">Section 4 - Developpement professionnel</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">A faire</span>
            </div>
            <p className="text-xs font-semibold text-[#0F3A63]">A completer apres la section en cours.</p>
          </article>
        </div>

        <div className="space-y-3 xl:col-span-6">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-sm font-bold text-[#0F3A63]">Section 2 - Pilotage & performance</h2>
              <span className="rounded-full bg-[#F6D4D4] px-3 py-1 text-xs font-semibold text-[#DF4C4C]">En cours</span>
            </div>

            <div className="space-y-4">
              <CriteriaRow label="Respect des delais de livraison" selected={4} progress={80} />
              <CriteriaRow label="Qualite des rapports produits" selected={3} progress={60} />
              <CriteriaRow label="Gestion du portefeuille clients" selected={3} progress={0} locked />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-[#79B742]">Commentaire de section</p>
              <textarea
                rows={3}
                placeholder="Exemple concrets, points forts..."
                className="w-full resize-none rounded-md border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button className="rounded-md bg-[#003B63] px-6 py-2 text-xs font-semibold text-white">Section suivante</button>
              <button className="rounded-md bg-[#79B742] px-8 py-2 text-xs font-semibold text-white">Sauvegarder</button>
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold text-[#79B742]">Circuit de validation</h3>
            <div className="space-y-3 text-xs font-semibold text-[#0F3A63]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DFECD4] text-[#79B742]">
                  OK
                </span>
                <p>Vous saisissez votre auto-evaluation</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2AA7D6] text-white">
                  1
                </span>
                <div>
                  <p>Soumission a la RH (vous)</p>
                  <p className="text-[11px] text-slate-400">Apres completion des 4 sections</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  3
                </span>
                <p>Validation RH - Isabella Beda</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default Monautoevaluation;
