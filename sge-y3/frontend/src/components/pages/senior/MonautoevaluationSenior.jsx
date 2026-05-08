import { useState } from "react";
import { seniorSelfEvaluation } from "@/components/pages/senior/seniorData";

function ScoreSelector({ selected }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          className={`h-8 w-9 border-r border-slate-200 text-xs font-bold last:border-0 ${
            selected === score ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63]"
          }`}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

function MonautoevaluationSenior() {
  const [status, setStatus] = useState("");

  return (
    <section className="space-y-5">
      <div className="rounded-lg bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">
        Le Senior s'auto-évalue lui-même sur ses compétences, son organisation, son comportement professionnel et son développement.
      </div>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.4fr]">
        <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400">{seniorSelfEvaluation.cycle}</p>
            <h2 className="text-xl font-extrabold text-[#0F3A63]">{seniorSelfEvaluation.name}</h2>
            <p className="text-sm font-semibold text-slate-500">{seniorSelfEvaluation.role}</p>
          </div>

          <div className="mb-4 flex items-center justify-between text-sm font-bold">
            <span className="text-[#0F3A63]">Progression</span>
            <span className="text-[#76B82A]">{seniorSelfEvaluation.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-[#76B82A]" style={{ width: `${seniorSelfEvaluation.progress}%` }} />
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold text-[#0F3A63]">Statut</span>
              <span className="font-bold text-[#F34D4D]">{seniorSelfEvaluation.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#0F3A63]">Destinataire</span>
              <span className="font-bold text-slate-500">{seniorSelfEvaluation.managerRecipient}</span>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-[#0F3A63]">
            Cette auto-évaluation personnelle sera envoyée au Manager pour compléter l'appréciation du cycle.
          </div>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-extrabold text-[#0F3A63]">Mon auto-évaluation</h2>
          <div className="space-y-4">
            {seniorSelfEvaluation.sections.map((section) => (
              <div key={section.title} className="rounded-lg bg-slate-50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-[#0F3A63]">{section.title}</h3>
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">{section.status}</span>
                </div>

                <div className="space-y-3">
                  {section.criteria.map((criterion) => (
                    <div key={criterion.label} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
                      <p className="text-sm font-semibold text-[#0F3A63]">{criterion.label}</p>
                      {criterion.score ? <ScoreSelector selected={criterion.score} /> : <span className="text-xs font-bold text-slate-400">A noter</span>}
                    </div>
                  ))}
                </div>

                <textarea
                  rows={3}
                  defaultValue={section.comment}
                  placeholder="Commentaires, exemples concrets, points d'amelioration..."
                  className="mt-4 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button onClick={() => setStatus("draft")} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-bold text-[#0F3A63]">
              Enregistrer brouillon
            </button>
            <button onClick={() => setStatus("sent")} className="rounded-md bg-[#76B82A] px-5 py-2 text-sm font-bold text-white">
              Envoyer au Manager
            </button>
          </div>
          {status ? (
            <p className="mt-3 text-right text-xs font-bold text-[#76B82A]">
              {status === "sent" ? "Auto-évaluation envoyée au Manager." : "Brouillon enregistré."}
            </p>
          ) : null}
        </article>
      </section>
    </section>
  );
}

export default MonautoevaluationSenior;
