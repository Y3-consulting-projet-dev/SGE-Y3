import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";

const scoreItems = [
  { label: "Leadership & management", score: "4.1", width: "76%" },
  { label: "Pilotage & performance", score: "3.8", width: "71%" },
  { label: "Compétences techniques", score: "3.9", width: "69%" },
  { label: "Savoir-?tre & relation client", score: "3.6", width: "63%" },
];

const selfEvalRows = [
  { label: "Leadership", score: "4/5" },
  { label: "Pilotage", score: "4/5" },
  { label: "Competences tech.", score: "3/5" },
];

const historyRows = [
  { cycle: "Cycle 2025", decision: "Maintien", tone: "text-[#0F4A72]" },
  { cycle: "Cycle 2024", decision: "Augmentation +6%", tone: "text-[#78B843]" },
  { cycle: "Cycle 2023", decision: "Promotion → Manager", tone: "text-[#0F4A72]" },
];

function Prendredecision({ candidate }) {
  const [decisionType, setDecisionType] = useState("Promotion");
  const [grade, setGrade] = useState("Manager Senior");
  const [increase, setIncrease] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");

  const cycleDecisionType = () => {
    const options = ["Promotion", "Maintien", "Formation obligatoire"];
    const next = options[(options.indexOf(decisionType) + 1) % options.length];
    setDecisionType(next);
  };

  const saveDraft = () => setStatus("Brouillon enregistré.");
  const closeAndNotify = () => setStatus("Décision clôturée et notification envoyée.");
  const person = candidate || { initials: "RO", name: "Revita OULE", role: "Manager - Auto-eval", score: "4.1 / 5" };

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">Prendre une décision</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {person.name} - {person.role} - Score RH validé {person.score}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.alert("Notifications bientôt disponibles.")} className="rounded-full p-2 text-slate-500 hover:bg-slate-200/70">
            <Bell size={15} />
          </button>
          <button onClick={closeAndNotify} className="rounded-full bg-[#7DBA45] px-4 py-2 text-xs font-bold text-white hover:bg-[#71AB3D]">
            Cloturer & notifier
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <article className="rounded-lg bg-white p-4">
          <div className="mb-4 flex items-center gap-3 rounded-md bg-[#DCECD7] px-3 py-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1F4A72] text-xs font-bold text-white">
              {person.initials}
            </span>
            <div>
              <p className="text-sm font-black text-[#0F3A63]">{person.name}</p>
              <p className="text-xs font-semibold text-slate-600">{person.role}</p>
            </div>
          </div>

          <div className="mb-4 flex items-start gap-3">
            <div className="grid flex-1 grid-cols-1 gap-5 md:grid-cols-2">
              {scoreItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm font-bold text-[#0F4A72]">
                    <p>{item.label}</p>
                    <p className="text-[#1D2A39]">{item.score}</p>
                  </div>
                  <div className="h-[6px] rounded-full bg-[#CED2D7]">
                    <div className="h-[6px] rounded-full bg-[#4E75C7]" style={{ width: item.width }} />
                  </div>
                </div>
              ))}
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#F34444] text-sm font-bold text-white">
              3.9
            </span>
          </div>

          <div className="mb-3 rounded-md bg-[#E3E3E3] px-3 py-2.5">
            <p className="text-sm font-bold text-[#7A7F86]">Recommandation RH (Isabella Beda)</p>
            <p className="mt-1 text-sm font-bold text-[#6B7078]">Promotion a Manager Senior envisageable</p>
            <p className="text-sm text-[#6B7078]">"Très bonne maîtrise du portefeuille clients, leadership reconnu par l'équipe."</p>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#78B843]">Auto-évaluation du Manager</p>
              <p className="mt-1 text-sm font-bold text-[#78B843]">Soumise le 20/04/2026 - Visible uniquement ici.</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Tableau de bord</p>
              <p className="text-2xl font-black text-[#0F4A72]">Vue cabinet</p>
            </div>
          </div>

          <div className="mb-4 space-y-5">
            {selfEvalRows.map((row) => (
              <div key={row.label} className="flex items-end justify-between">
                <p className="text-lg font-black leading-none text-[#0F3A63]">{row.label}</p>
                <p className="text-xs font-bold text-[#78B843]">{row.score}</p>
              </div>
            ))}
            <p className="text-[10px] text-slate-500">
              "Je souhaite prendre plus de responsabilités sur des mandats d'envergure. Prêt à évoluer."
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-[#0F3A63]">Annotation Associé (Facultative)</p>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Commenter l'auto-évaluation du manager..."
              className="min-h-[74px] w-full resize-none rounded-md bg-[#D9D9D9] px-3 py-3 text-sm text-slate-600 outline-none placeholder:text-slate-500"
            />
          </div>
        </article>

        <aside className="space-y-3">
          <section className="rounded-lg bg-white p-4">
            <p className="text-lg font-black text-[#0F3A63]">Décision RH</p>

            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1 text-sm font-bold text-[#1E2B3A]">Type de décision</p>
                <button onClick={cycleDecisionType} className="flex h-9 w-full items-center justify-between rounded-md bg-[#D0D0D0] px-3 text-sm font-semibold text-[#2D2D2D]">
                  {decisionType}
                  <ChevronDown size={14} />
                </button>
              </div>

              <div>
                <p className="mb-1 text-sm font-bold text-[#1E2B3A]">Nouveau grade</p>
                <input
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  className="h-9 w-full rounded-md bg-[#D0D0D0] px-3 text-sm font-semibold text-[#2D2D2D] outline-none"
                />
              </div>

              <div>
                <p className="mb-1 text-sm font-bold text-[#1E2B3A]">Taux d'augmentation (%)</p>
                <input
                  value={increase}
                  onChange={(event) => setIncrease(event.target.value)}
                  placeholder="Ex:8%"
                  className="h-9 w-full rounded-md bg-[#D0D0D0] px-3 text-sm text-slate-600 outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <p className="mb-1 text-sm font-bold text-[#1E2B3A]">Commentaire Associ?</p>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Justification de la décision, axes de développement..."
                  className="min-h-[96px] w-full resize-none rounded-md bg-[#D0D0D0] px-3 py-3 text-sm text-slate-600 outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-[#1E2B3A]">Envoyer la notification automatique à la clôture</p>
                <div className="flex items-center gap-2">
                  <button onClick={saveDraft} className="rounded-md bg-[#D0D0D0] px-3 py-2 text-xs font-bold text-slate-600">Sauvegarde brouillon</button>
                  <button onClick={closeAndNotify} className="rounded-md bg-[#0C4B6C] px-4 py-2 text-xs font-bold text-white">Cloturer & notifier</button>
                </div>
                {status ? <p className="mt-2 text-xs font-semibold text-[#0F4A72]">{status}</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-sm border-l-4 border-[#78B843] bg-[#DCECD7] px-3 py-2 text-sm font-bold text-[#1F4B2D]">
            La cloture est irreversible.
            <br />
            Le collaborateur sera notifié automatiquement.
          </section>

          <section className="rounded-lg bg-white p-4">
            <p className="mb-3 text-xl font-black text-[#0F3A63]">Contexte - historique des décisions</p>
            <div className="space-y-4">
              {historyRows.map((row) => (
                <div key={row.cycle} className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-bold text-[#0F4A72]">{row.cycle}</p>
                  <p className={`font-bold ${row.tone}`}>{row.decision}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

export default Prendredecision;
