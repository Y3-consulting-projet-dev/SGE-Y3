function ScoreChip({ value, label, detail }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#D5E9C5] text-sm font-bold text-[#4E8B1B]">
        {value}
      </span>
      <div>
        <p className="text-sm font-bold text-[#0F3A63]">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function Evaluermonequipe() {
  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-slate-400">Evaluations - Yasmine K (Senior)</p>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                  YK
                </span>
                <div>
                  <p className="text-sm font-bold text-[#0F3A63]">Yasmine K</p>
                  <p className="text-xs text-slate-400">Senior</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 text-xs font-semibold">
              <span className="text-[#0F3A63]">Cycle 2026</span>
              <span className="rounded-full bg-[#DDECCF] px-2 py-1 text-[#4E8B1B]">En cours</span>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-[#76B82A]">Auto-evaluation du collaborateur</p>
            <div className="space-y-2 text-sm font-semibold text-[#0F3A63]">
              <div className="flex items-center justify-between">
                <span>Competences techniques</span>
                <span className="text-[#76B82A]">4 / 5</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Savoir-etre</span>
                <span className="text-[#76B82A]">3 / 5</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Objectifs atteints</span>
                <span className="text-[#76B82A]">4 / 5</span>
              </div>
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
              "Bonne maitrise des dossiers clients, souhaite evoluer vers un poste de Manager."
            </p>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-[#76B82A]">Entretien annuel</p>
            <p className="text-lg font-bold text-[#0F3A63]">22/04/2026 - 14h30</p>
            <p className="mt-3 text-sm font-semibold text-[#0F3A63]">Mode</p>
            <p className="text-lg font-bold text-[#0F3A63]">Presentiel</p>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow-sm md:col-span-2">
              <ScoreChip value="3.5" label="Score pondere final" detail="Technique 60% - Savoir-etre 40%" />
              <div className="mt-5 space-y-3 text-sm font-semibold text-[#0F3A63]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Technique (60%)</span>
                  <span className="text-[#76B82A]">4/5 - 2.4 pts</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Savoir-etre (40%)</span>
                  <span className="text-[#E53935]">2/5 - 0.8 pts</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>Score total</span>
                  <span className="text-[#76B82A]">3.2 / 5</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-[#E3EFD8] p-4 shadow-sm">
              <p className="mb-1 text-sm font-bold text-[#76B82A]">Note annuel</p>
              <p className="mb-4 text-xs text-slate-500">22/04/2026 - 14h30</p>
              <div className="mb-3">
                <p className="mb-1 text-xs font-semibold text-[#0F3A63]">Mode</p>
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F3A63]">
                  Presentiel
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-[#0F3A63]">Notes de l'entretien</p>
                <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-xs text-slate-400">
                  Points abordes lors de l'entretien...
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-[#76B82A]">Evaluation Manager</p>
            <div className="mb-4 rounded-sm bg-[#DCECCB] px-3 py-2 text-xs font-semibold text-[#0F3A63]">
              Ecart detecte sur Savoir-etre : auto-eval 3/5, votre note 2/5. Un commentaire est requis.
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-[#0F3A63]">Competences techniques</p>
                <div className="flex overflow-hidden rounded-md border border-slate-200">
                  {[1, 2, 3, 4].map((value) => (
                    <button
                      key={`tech-${value}`}
                      className={`h-9 w-10 border-r border-slate-200 text-sm font-semibold ${
                        value === 4 ? "bg-[#003B63] text-white" : "bg-slate-50 text-[#0F3A63]"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                  <button className="h-9 w-10 bg-slate-100 text-sm text-[#76B82A]">✓</button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-[#0F3A63]">Savoir-etre</p>
                <div className="flex overflow-hidden rounded-md border border-slate-200">
                  {[2, 1, 3, 4].map((value, index) => (
                    <button
                      key={`savoir-${value}-${index}`}
                      className={`h-9 w-10 border-r border-slate-200 text-sm font-semibold ${
                        value === 2 ? "bg-[#003B63] text-white" : "bg-slate-50 text-[#0F3A63]"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                  <button className="h-9 w-10 bg-slate-100 text-sm text-slate-500">⊗</button>
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-sm bg-[#F4D6D8] px-3 py-2 text-xs font-semibold text-[#A4252F]">
              Ecart &gt; 2 pts - justification obligatoire
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="mb-2 text-xs font-semibold text-[#0F3A63]">Justification de l'ecart</p>
              <textarea
                rows={3}
                placeholder="Expliquez l'ecart de la notation..."
                className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Evaluermonequipe;
