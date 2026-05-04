import { useState } from "react";

const skills = [
  { label: "Mes competences", score: "4/5", percent: 78 },
  { label: "Audit & commissariat", score: "3/5", percent: 63 },
  { label: "Outils CEGID", score: "2/5", percent: 40 },
  { label: "Communication client", score: "3/5", percent: 64 },
];

function Mondeveloppement() {
  const [requestedTrainings, setRequestedTrainings] = useState([]);
  const markRequested = (id) => {
    setRequestedTrainings((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-[22px] font-bold leading-tight text-[#0F3A63]">Mon plan de formation</h2>

            <div className="rounded-md bg-slate-100 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-[#0F3A63]">CEGID - Module avance</p>
                  <p className="text-[12px] font-semibold text-slate-500">Assignee par Isabella Beda - Mai 2026</p>
                </div>
                <span className="rounded-md bg-[#DCECCB] px-3 py-1 text-[12px] font-bold text-[#76B82A]">Planifiee</span>
              </div>

              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <p className="font-bold text-[#0F3A63]">Fournisseur</p>
                  <p className="font-bold text-[#0F3A63]">CEGID Academy</p>
                </div>
                <div className="flex justify-between">
                  <p className="font-bold text-[#0F3A63]">Duree</p>
                  <p className="font-bold text-[#0F3A63]">2 jours</p>
                </div>
                <div className="flex justify-between">
                  <p className="font-bold text-[#0F3A63]">Date prevue</p>
                  <p className="font-bold text-[#76B82A]">12-13 mai 2026</p>
                </div>
                <div className="flex justify-between">
                  <p className="font-bold text-[#0F3A63]">Certifiante</p>
                  <p className="font-bold text-[#76B82A]">Oui</p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-md bg-slate-100 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-[#0F3A63]">Techniques de communication client</p>
                  <p className="text-[12px] font-semibold text-[#0F3A63]">Assignee par Diallo S. - Juin 2026</p>
                </div>
                <span className="rounded-md bg-[#DCECCB] px-3 py-1 text-[12px] font-bold text-[#76B82A]">A confirmer</span>
              </div>

              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <p className="font-bold text-[#0F3A63]">Fournisseur</p>
                  <p className="font-bold text-[#0F3A63]">IFACI</p>
                </div>
                <div className="flex justify-between">
                  <p className="font-bold text-[#0F3A63]">Duree</p>
                  <p className="font-bold text-[#0F3A63]">1 jour</p>
                </div>
                <div className="flex justify-between">
                  <p className="font-bold text-[#0F3A63]">Certifiante</p>
                  <p className="font-bold text-[#0F3A63]">Non</p>
                </div>
              </div>
            </div>
          </article>

          <div>
            <h3 className="mb-2 text-[22px] font-bold leading-tight text-[#0F3A63]">Catalogue formations disponibles</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <article className="rounded-md bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-[14px] font-bold text-[#0F3A63]">Audit des groupes consolides</p>
                  <button
                    onClick={() => markRequested("audit-groupes")}
                    className="rounded-md bg-[#DCECCB] px-3 py-1 text-[12px] font-bold text-[#76B82A]"
                  >
                    {requestedTrainings.includes("audit-groupes") ? "Demande envoyee" : "Demander"}
                  </button>
                </div>
                <p className="text-[12px] font-semibold text-slate-500">IFACI - 3 jours - Certifiante</p>
              </article>

              <article className="rounded-md bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-[14px] font-bold text-[#0F3A63]">Normes IFRS - mise a jour 2026</p>
                  <button
                    onClick={() => markRequested("normes-ifrs")}
                    className="rounded-md bg-[#DCECCB] px-3 py-1 text-[12px] font-bold text-[#76B82A]"
                  >
                    {requestedTrainings.includes("normes-ifrs") ? "Demande envoyee" : "Demander"}
                  </button>
                </div>
                <p className="text-[12px] font-semibold text-slate-500">CNCC - 2 jours - Certifiante</p>
              </article>

              <article className="rounded-md bg-white p-4 shadow-sm md:col-span-1">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-[14px] font-bold text-[#0F3A63]">Excel & tableaux de bord avances</p>
                  <button
                    onClick={() => markRequested("excel-tdb")}
                    className="rounded-md bg-[#DCECCB] px-3 py-1 text-[12px] font-bold text-[#76B82A]"
                  >
                    {requestedTrainings.includes("excel-tdb") ? "Demande envoyee" : "Demander"}
                  </button>
                </div>
                <p className="text-[12px] font-semibold text-slate-500">ENS - 1 jour</p>
              </article>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <article className="rounded-md bg-white p-4 shadow-sm">
            <div className="space-y-3">
              {skills.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-[13px] font-bold text-[#0F3A63]">
                    <p>{item.label}</p>
                    <span>{item.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-300">
                    <div className="h-1.5 rounded-full bg-[#76B82A]" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-sm bg-[#DCECCB] px-3 py-2 text-[12px] font-bold text-[#0F3A63]">
              Niveau requis pour le poste
            </div>
          </article>

          <article className="rounded-md bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[20px] font-bold text-[#0F3A63]">Mes souhaits d'evolution</h3>
            <div className="rounded-md bg-slate-100 p-3 text-[12px] text-slate-500">
              "Evoluer vers un poste de Senior d'ici 2027. Je souhaite me specialiser en audit des groupes consolides."
            </div>
            <p className="mt-4 text-[12px] font-semibold text-slate-500">
              Saisi lors de l'auto-evaluation - visible par le Manager.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default Mondeveloppement;
