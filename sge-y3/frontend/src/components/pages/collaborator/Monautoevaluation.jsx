import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

const sectionCards = [
  { title: "Section 1", subtitle: "Savoir-etre", footer: "Complete", progress: 100, done: true },
  { title: "Section 2", subtitle: "Competences tech.", footer: "En cours -> 40%", progress: 40, done: false },
  { title: "Section 3", subtitle: "Objectifs atteints", footer: "A faire", progress: 0, done: false },
  { title: "Section 4", subtitle: "Evolution souhaitee", footer: "A faire", progress: 0, done: false },
];

const criteria = [
  { label: "Maitrise des outils comptables (CEGID, Sage)", selected: 3, note: "" },
  { label: "Redaction des rapports d'audit", selected: 4, note: "" },
  { label: "Analyse et interpretation des donnees financieres", selected: 2, note: "2 questions restantes dans cette section" },
];

const summary = [
  { label: "Ponctualite & fiabilite", value: "4/5" },
  { label: "Travail en equipe", value: "4/5" },
  { label: "Communication", value: "3/5" },
  { label: "Adaptabilite", value: "4/5" },
];

const gradingHelp = [
  { level: "1", text: "Insuffisant - objectif non atteint", color: "text-[#FF7A00]" },
  { level: "2", text: "En progression - a ameliorer", color: "text-[#0F3A63]" },
  { level: "3", text: "Satisfaisant - niveau attendu", color: "text-[#0F3A63]" },
  { level: "4", text: "Bon - depasse les attentes", color: "text-[#0F3A63]" },
  { level: "5", text: "Excellent - reference dans l'equipe", color: "text-[#76B82A]" },
];

function ScoreRow({ label, selected, note }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-[#0F3A63]">{label}</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            className={`inline-flex h-6 w-8 items-center justify-center rounded text-[12px] font-bold ${
              selected === score ? "bg-[#0B4C7A] text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      {note ? <p className="text-[9px] text-slate-400">{note}</p> : null}
    </div>
  );
}

function Monautoevaluation() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-slate-500">Cycle 2025 - Formulaire en cours - Sauvegarde auto activee</div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <p className="font-semibold text-[#0F3A63]">Derniere sauvegarde automatique : il y a 2 min</p>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#0F3A63]">Section 2 / 4</span>
          <button className="font-semibold text-[#76B82A] hover:underline">Sauvegarder maintenant</button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sectionCards.map((card) => (
          <article key={card.title} className="rounded-md bg-[#003B63] px-3 py-2 text-white">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-bold">{card.title}</h2>
              {card.done ? <Check size={14} className="text-white" /> : null}
            </div>
            <p className="text-[12px] font-semibold">{card.subtitle}</p>
            <div className="mt-3 h-1.5 rounded-full bg-slate-200">
              <div
                className={`h-1.5 rounded-full ${card.progress === 100 ? "bg-[#7BC443]" : "bg-[#D6DCE2]"}`}
                style={{ width: `${card.progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-slate-200">{card.footer}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <article className="rounded-md bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[30px] font-bold leading-none text-[#0F3A63]">Section 2 - Competences techniques</h3>
            <span className="text-[16px] font-bold text-[#32B3E0]">En cours</span>
          </div>

          <div className="space-y-3.5">
            {criteria.map((item) => (
              <ScoreRow key={item.label} label={item.label} selected={item.selected} note={item.note} />
            ))}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-[#0F3A63]">Commentaire de section (facultatif)</p>
            <textarea
              rows={4}
              placeholder="Points forts, exemples concrets, contexte..."
              className="w-full resize-none rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600 outline-none"
            />
          </div>

          <div className="mt-3 rounded-sm bg-[#DCECCB] px-3 py-2 text-[10px] font-semibold text-[#5A8A3A]">
            Les questions obligatoires (sans reponse) bloqueront la soumission. Les questions avec etoile * sont
            requises.
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setSaved(false)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500"
            >
              <ChevronLeft size={14} />
              Section precedente
            </button>
            <button
              onClick={() => setSaved(true)}
              className="inline-flex items-center gap-2 rounded-md bg-[#76B82A] px-4 py-2 text-[12px] font-bold text-white"
            >
              Sauvegarder et continuer
              <ChevronRight size={14} />
            </button>
          </div>
          {saved ? <p className="mt-2 text-right text-[11px] font-semibold text-[#76B82A]">Sauvegarde reussie.</p> : null}
        </article>

        <div className="space-y-4">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[22px] font-bold text-[#0F3A63]">Section 1 - Savoir-etre</h3>
              <Check size={16} className="text-[#7BC443]" />
            </div>
            <p className="mb-4 text-[12px] font-semibold text-[#76B82A]">Complete</p>

            <div className="space-y-3">
              {summary.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-[12px]">
                  <p className="font-semibold text-[#0F3A63]">{item.label}</p>
                  <span className="font-bold text-[#76B82A]">{item.value}</span>
                </div>
              ))}
            </div>

            <button className="mx-auto mt-4 block rounded-md bg-[#DCECCB] px-8 py-1.5 text-[12px] font-semibold text-[#76B82A]">
              Modifier
            </button>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Aide a la notation</h3>
            <div className="space-y-2">
              {gradingHelp.map((item) => (
                <div key={item.level} className="flex items-center gap-2 text-[12px]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 font-bold text-slate-500">
                    {item.level}
                  </span>
                  <p className={`font-semibold ${item.color}`}>{item.text}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default Monautoevaluation;
