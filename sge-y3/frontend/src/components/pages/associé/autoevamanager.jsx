import { useState } from "react";
import { Bell } from "lucide-react";

const kpis = [
  { title: "Managers évalués", value: "3/3", subtitle: "Toutes validées RH" },
  { title: "Annotations posées", value: "1/3", subtitle: "" },
  { title: "Décisions prises", value: "1/3", subtitle: "2 en attente" },
];

const managerAnswers = [
  { label: "Leadership & animation d'équipe", score: "4/5" },
  { label: "Pilotage des missions", score: "4/5" },
  { label: "Compétences techniques", score: "3/5" },
  { label: "Relation client & communication", score: "4/5" },
];

function Autoevamanager() {
  const [activeTab, setActiveTab] = useState("auto");
  const [evaluationScores, setEvaluationScores] = useState({
    "Leadership & animation d'équipe": 4,
    "Pilotage des missions": 4,
    "Compétences techniques": 3,
    "Relation client & communication": 4,
  });
  const [evaluationComment, setEvaluationComment] = useState("");
  const [note, setNote] = useState("");
  const [savedAnnotation, setSavedAnnotation] = useState("");
  const [savedEvaluation, setSavedEvaluation] = useState(null);
  const [status, setStatus] = useState("");
  const evaluationAverage = (
    Object.values(evaluationScores).reduce((total, score) => total + score, 0) / Object.values(evaluationScores).length
  ).toFixed(1);

  const saveEvaluation = () => {
    setSavedEvaluation({ scores: evaluationScores, comment: evaluationComment, average: evaluationAverage });
    setStatus("Évaluation managériale enregistrée.");
  };

  const saveAnnotation = () => {
    setSavedAnnotation(note);
    setStatus("Annotation enregistrée.");
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-[#0F3A63]">Auto-évaluations des Managers</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => window.alert("Notifications bientôt disponibles.")} className="rounded-full p-2 text-slate-500 hover:bg-slate-200/70">
            <Bell size={15} />
          </button>
          <button onClick={() => window.alert("Ouverture des synthèses RH...")} className="rounded-full bg-[#7DBA45] px-4 py-2 text-xs font-bold text-white hover:bg-[#71AB3D]">
            Voir les synthèses RH
          </button>
        </div>
      </header>

      <section className="rounded-sm border-l-4 border-[#77B944] bg-[#DCECD8] px-3 py-2 text-sm font-bold text-[#1F4B2D]">
        Les auto-évaluations des Managers sont visibles uniquement après validation RH. Vous pouvez les annoter avant de saisir la décision finale.
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
              Auto-évaluation
            </button>
            <button onClick={() => setActiveTab("evaluation")} className={`${activeTab === "evaluation" ? "border-b-2 border-[#F34B4B]" : ""} pb-1`}>
              Évaluation managériale
            </button>
            <button onClick={() => setActiveTab("annotation")} className={`${activeTab === "annotation" ? "border-b-2 border-[#F34B4B]" : ""} pb-1`}>
              Mon annotation
            </button>
          </div>
          <span className="rounded-full bg-[#E5EFE1] px-4 py-1 text-sm font-semibold text-[#F24A4A]">Décision en attente</span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.95fr]">
          <article className="rounded-lg bg-white p-4 shadow-sm">
            {activeTab === "evaluation" ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-extrabold text-[#0F4A72]">Évaluation managériale</p>
                  <span className="rounded-full bg-[#DDECD8] px-3 py-1 text-xs font-bold text-[#78B843]">
                    Moyenne {evaluationAverage} / 5
                  </span>
                </div>

                <div className="space-y-5">
                  {Object.entries(evaluationScores).map(([label, score]) => (
                    <div key={label}>
                      <p className="mb-2 text-sm font-bold text-[#0F3A63]">{label}</p>
                      <div className="flex overflow-hidden rounded-md border border-slate-200">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={`${label}-${value}`}
                            onClick={() => {
                              setEvaluationScores((scores) => ({ ...scores, [label]: value }));
                              setStatus("");
                            }}
                            className={`h-9 w-10 border-r border-slate-200 text-sm font-bold last:border-r-0 ${
                              value === score ? "bg-[#0C4B6C] text-white" : "bg-slate-100 text-[#0F3A63]"
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-[3px] w-32 rounded-full bg-slate-300">
                          <div className="h-[3px] rounded-full bg-[#78B843]" style={{ width: `${score * 20}%` }} />
                        </div>
                        <span className="text-xs font-bold text-[#78B843]">{score * 20}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold text-[#0F4A72]">Commentaire d'évaluation</p>
                  <textarea
                    value={evaluationComment}
                    onChange={(event) => {
                      setEvaluationComment(event.target.value);
                      setStatus("");
                    }}
                    placeholder="Votre évaluation managériale, points de vigilance, forces observées..."
                    className="min-h-[96px] w-full resize-none rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-600 outline-none placeholder:text-slate-500"
                  />
                </div>

                <button onClick={saveEvaluation} className="mt-4 rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">
                  Enregistrer l'évaluation
                </button>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm font-extrabold text-[#0F4A72]">Réponses du Manager</p>

                <div className="space-y-5">
                  {managerAnswers.map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#0F3A63]">{row.label}</p>
                      <p className="text-sm font-bold text-[#78B843]">{row.score}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-7">
                  <p className="text-sm font-extrabold text-[#0F4A72]">Commentaire du Manager</p>
                  <p className="mt-2 text-sm text-slate-600">"Bonne année malgré la charge importante.</p>
                  <p className="text-sm text-slate-600">Souhaite évoluer vers un rôle de Manager Sénior avec un portefeuille clients dédié."</p>
                </div>
              </>
            )}
          </article>

          <article className="rounded-lg bg-white p-3 shadow-sm">
            <p className="mb-3 text-sm font-extrabold text-[#0F4A72]">Annotation Associé</p>
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setActiveTab("annotation");
                setStatus("");
              }}
              placeholder="Votre lecture de cette auto-évaluation..."
              className="min-h-[240px] w-full resize-none rounded-lg bg-[#D0D0D0] px-3 py-6 text-sm text-slate-600 outline-none placeholder:text-slate-500"
            />

            {savedAnnotation ? (
              <div className="mt-3 rounded-md bg-[#DDECD8] px-3 py-2">
                <p className="text-xs font-bold text-[#78B843]">Annotation sauvegardée</p>
                <p className="mt-1 text-sm font-semibold text-[#0F3A63]">{savedAnnotation}</p>
              </div>
            ) : null}

            {savedEvaluation ? (
              <div className="mt-3 rounded-md bg-slate-100 px-3 py-2">
                <p className="text-xs font-bold text-[#0F4A72]">Évaluation sauvegardée</p>
                <p className="mt-1 text-sm font-semibold text-[#0F3A63]">Moyenne : {savedEvaluation.average} / 5</p>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button onClick={saveAnnotation} className="rounded-md bg-[#0C4B6C] px-5 py-2 text-sm font-bold text-white">Enregistrer</button>
              <button onClick={() => setStatus("Décision envoyée vers validation finale.")} className="rounded-md bg-[#0C4B6C] px-7 py-2 text-sm font-bold text-white">Décider</button>
            </div>
            {status ? <p className="mt-2 text-xs font-semibold text-[#0F4A72]">{status}</p> : null}
          </article>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-[#EBF0F4] px-3 py-2">
          <p className="text-sm font-bold text-[#0F4A72]">Auto-évaluation disponible - pas encore annotée.</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#DDECD8] px-4 py-1 text-sm font-semibold text-[#0F4A72]">Décision en attente</span>
            <button onClick={() => setStatus("Dossier ouvert pour examen.")} className="rounded-full bg-[#E5EFE1] px-6 py-1 text-sm font-semibold text-[#F24A4A]">Examiner</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Autoevamanager;
