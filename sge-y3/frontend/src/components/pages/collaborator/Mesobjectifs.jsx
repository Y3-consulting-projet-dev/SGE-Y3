import { useState } from "react";

const topCards = [
  { title: "Objectifs actifs", value: "3", subtitle: "" },
  { title: "Atteints", value: "1", subtitle: "sur 3" },
  { title: "En retard", value: "1", subtitle: "a rattraper" },
];

function Mesobjectifs() {
  const [updatedGoal, setUpdatedGoal] = useState("");
  const [progress, setProgress] = useState(40);

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-semibold text-slate-500">Objectifs SMART - Cycle 2026</p>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {topCards.map((card) => (
          <article key={card.title} className="rounded-md bg-[#003B63] px-4 py-3 text-white">
            <h2 className="mb-3 text-[12px] font-bold">{card.title}</h2>
            <p className={`text-[18px] font-bold ${card.title === "En retard" ? "text-[#F34D4D]" : "text-[#7BC443]"}`}>
              {card.value}
            </p>
            <p className="mt-2 text-[12px] font-semibold text-slate-200">{card.subtitle}</p>
          </article>
        ))}
      </section>

      <div className="space-y-4">
        <article className="rounded-md bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[22px] font-bold leading-tight text-[#0F3A63]">Mes objectifs du cycle</h3>
              <p className="mt-1 text-[16px] font-bold leading-tight text-[#0F3A63]">Reduire le delai de rendu des rapports a 48h</p>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">Assigne par Diallo S. - Echeance 30/04/2026</p>
            </div>
            <span className="rounded-full bg-[#F2C8C8] px-3 py-1 text-[12px] font-bold text-[#B84444]">En retard</span>
          </div>

          <div className="h-2 rounded-full bg-slate-300">
            <div className="h-2 rounded-full bg-[#FF0000]" style={{ width: `${progress}%` }} />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[14px] font-bold text-[#0F3A63]">Mise a jour de progression</p>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
              className="h-2 w-[46%] cursor-pointer accent-[#2FB6D9]"
            />
            <span className="text-[14px] font-bold text-[#F34D4D]">{progress}%</span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <input
              placeholder="Expliquer les difficultes rencontrees..."
              className="h-10 flex-1 rounded-md bg-slate-100 px-3 text-[12px] text-slate-600 outline-none placeholder:text-slate-400"
            />
            <button
              onClick={() => setUpdatedGoal("objectif-principal")}
              className="rounded-md bg-[#DCECCB] px-6 py-2 text-[12px] font-bold text-[#0F3A63]"
            >
              Mettre a jour
            </button>
          </div>
          {updatedGoal === "objectif-principal" ? (
            <p className="mt-2 text-[11px] font-semibold text-[#76B82A]">Mise à jour enregistrée.</p>
          ) : null}
        </article>

        <article className="rounded-md bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[22px] font-bold leading-tight text-[#0F3A63]">Maitriser le module CEGID avance</h3>
              <p className="mt-1 text-[12px] font-bold text-[#0F3A63]">Assigne par Diallo S. - Echeance 31/05/2026</p>
            </div>
            <span className="rounded-md bg-[#7BC443] px-3 py-1 text-[12px] font-bold text-white">En bonne voie</span>
          </div>

          <div className="h-2 rounded-full bg-slate-300">
            <div className="h-2 w-[62%] rounded-full bg-[#76B82A]" />
          </div>

          <div className="mt-3 flex items-center justify-between text-[12px]">
            <p className="font-semibold text-slate-500">Indicateur : certification validée avant fin mai 2026.</p>
            <span className="font-bold text-[#76B82A]">60%</span>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setUpdatedGoal("objectif-cegid")}
              className="rounded-md bg-[#DCECCB] px-6 py-2 text-[12px] font-bold text-[#0F3A63]"
            >
              Mettre a jour
            </button>
          </div>
          {updatedGoal === "objectif-cegid" ? (
            <p className="mt-2 text-right text-[11px] font-semibold text-[#76B82A]">Mise à jour enregistrée.</p>
          ) : null}
        </article>

        <article className="rounded-md bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[22px] font-bold leading-tight text-[#0F3A63]">Auditer 10 dossiers clients en autonomie</h3>
              <p className="mt-1 text-[12px] font-bold text-[#0F3A63]">Assigne par Diallo S. - Echeance 30/06/2026</p>
            </div>
            <span className="rounded-md bg-[#7BC443] px-5 py-1 text-[12px] font-bold text-white">Atteint</span>
          </div>

          <div className="h-2 rounded-full bg-slate-300">
            <div className="h-2 w-full rounded-full bg-[#76B82A]" />
          </div>

          <div className="mt-3 flex items-center justify-between text-[12px]">
            <p className="font-semibold text-slate-500">10/10 dossiers audités - validés par le Manager.</p>
            <span className="font-bold text-[#76B82A]">100%</span>
          </div>
        </article>
      </div>
    </div>
  );
}

export default Mesobjectifs;

