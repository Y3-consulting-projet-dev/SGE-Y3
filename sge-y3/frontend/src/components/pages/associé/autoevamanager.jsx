import { useState } from "react";
import { Bell } from "lucide-react";

const kpis = [
  { title: "Managers evalues", value: "3/3", subtitle: "Toutes validees RH" },
  { title: "Annotations posees", value: "1/3", subtitle: "" },
  { title: "Decisions prises", value: "1/3", subtitle: "2 en attente" },
];

const managerAnswers = [
  { label: "Leadership & animation equipe", score: "4/5" },
  { label: "Pilotage des missions", score: "4/5" },
  { label: "Competences techniques", score: "3/5" },
  { label: "Relation client & communication", score: "4/5" },
];

function Autoevamanager() {
  const [activeTab, setActiveTab] = useState("auto");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight text-[#0F3A63]">Auto-evaluations des Managers</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => window.alert("Notifications bientot disponibles.")} className="rounded-full p-2 text-slate-500 hover:bg-slate-200/70">
            <Bell size={15} />
          </button>
          <button onClick={() => window.alert("Ouverture des syntheses RH...")} className="rounded-full bg-[#7DBA45] px-4 py-2 text-xs font-bold text-white hover:bg-[#71AB3D]">
            Voir syntheses RH
          </button>
        </div>
      </header>

      <section className="rounded-sm border-l-4 border-[#77B944] bg-[#DCECD8] px-3 py-2 text-sm font-bold text-[#1F4B2D]">
        Les auto-evaluations des Managers sont visibles uniquement apres validation RH. Vous pouvez les annoter avant de saisir la decision finale.
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {kpis.map((item) => (
          <article key={item.title} className="rounded-lg bg-[#0D496A] p-4 text-white">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-3 text-2xl font-extrabold leading-none">{item.value}</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{item.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg bg-[#D4DADF] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-8 text-sm font-semibold text-[#0F3A63]">
            <button onClick={() => setActiveTab("auto")} className={`${activeTab === "auto" ? "border-b-2 border-[#F34B4B]" : ""} pb-1 font-bold`}>
              Auto-evaluation
            </button>
            <button onClick={() => setActiveTab("evaluation")} className={`${activeTab === "evaluation" ? "border-b-2 border-[#F34B4B]" : ""} pb-1`}>
              Evaluation manageriale
            </button>
            <button onClick={() => setActiveTab("annotation")} className={`${activeTab === "annotation" ? "border-b-2 border-[#F34B4B]" : ""} pb-1`}>
              Mon annotation
            </button>
          </div>
          <span className="rounded-full bg-[#E5EFE1] px-4 py-1 text-sm font-semibold text-[#F24A4A]">Decision en attente</span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.95fr]">
          <article className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-3 text-base font-extrabold text-[#0F4A72]">Reponses du Manager</p>

            <div className="space-y-5">
              {managerAnswers.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#0F3A63]">{row.label}</p>
                  <p className="text-sm font-bold text-[#78B843]">{row.score}</p>
                </div>
              ))}
            </div>

            <div className="mt-7">
              <p className="text-base font-extrabold text-[#0F4A72]">Commentaire du Manager</p>
              <p className="mt-2 text-sm text-slate-600">"Bonne annee malgre la charge importante.</p>
              <p className="text-sm text-slate-600">Souhaite evoluer vers un role de Manager Senior avec un portefeuille clients dedie."</p>
            </div>
          </article>

          <article className="rounded-lg bg-white p-3 shadow-sm">
            <p className="mb-3 text-base font-extrabold text-[#0F4A72]">Annotation Associe</p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Votre lecture de cette auto-evaluation..."
              className="min-h-[240px] w-full resize-none rounded-lg bg-[#D0D0D0] px-3 py-6 text-sm text-slate-600 outline-none placeholder:text-slate-500"
            />

            <div className="mt-4 flex items-center justify-between gap-2">
              <button onClick={() => setStatus("Annotation enregistree.")} className="rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">Enregistrer</button>
              <button onClick={() => setStatus("Decision envoyee vers validation finale.")} className="rounded-md bg-[#0C4B6C] px-7 py-2 text-sm font-bold text-white">Decider</button>
            </div>
            {status ? <p className="mt-2 text-xs font-semibold text-[#0F4A72]">{status}</p> : null}
          </article>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-[#EBF0F4] px-3 py-2">
          <p className="text-sm font-bold text-[#0F4A72]">Auto-evaluation disponible - pas encore annotee.</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#DDECD8] px-4 py-1 text-sm font-semibold text-[#0F4A72]">Decision en attente</span>
            <button onClick={() => setStatus("Dossier ouvert pour examen.")} className="rounded-full bg-[#E5EFE1] px-6 py-1 text-sm font-semibold text-[#F24A4A]">Examiner</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Autoevamanager;
