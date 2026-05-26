import { useMemo, useState } from "react";

const supportSubmissions = [
  {
    id: "fleur-ng",
    name: "Fleur Nguessan",
    role: "Support administratif",
    email: "fleur.nguessan@ycubeac.com",
    status: "Soumis aux Associes",
    average: 4.0,
    answers: [
      ["Qualite de service", "4/5"],
      ["Organisation et priorites", "4/5"],
      ["Amelioration continue", "4/5"],
    ],
    comment: "Bonne coordination avec les equipes et relances regulieres.",
  },
  {
    id: "porthela-k",
    name: "Porthela Kakou",
    role: "Support",
    email: "porthela.kakou@ycubeac.com",
    status: "Soumis aux Associes",
    average: 3.6,
    answers: [
      ["Qualite de service", "4/5"],
      ["Organisation et priorites", "3/5"],
      ["Amelioration continue", "4/5"],
    ],
    comment: "Progression notable dans le suivi des demandes internes.",
  },
  {
    id: "aziz-o",
    name: "Aziz Ouattara",
    role: "Support",
    email: "aziz.ouattara@ycubeac.com",
    status: "Soumis aux Associes",
    average: 3.8,
    answers: [
      ["Qualite de service", "4/5"],
      ["Organisation et priorites", "4/5"],
      ["Amelioration continue", "3/5"],
    ],
    comment: "Bonne reactivite, documentation a renforcer.",
  },
  {
    id: "adele-c",
    name: "Adele Creppy",
    role: "Support",
    email: "adele.creppy@ycubeac.com",
    status: "Soumis aux Associes",
    average: 4.2,
    answers: [
      ["Qualite de service", "4/5"],
      ["Organisation et priorites", "4/5"],
      ["Amelioration continue", "5/5"],
    ],
    comment: "Tres bonne contribution au fonctionnement support.",
  },
];

function AutoevaluationSupport() {
  const [selectedId, setSelectedId] = useState(supportSubmissions[0].id);
  const [annotation, setAnnotation] = useState("");
  const [status, setStatus] = useState("");
  const selectedSubmission = useMemo(
    () => supportSubmissions.find((submission) => submission.id === selectedId) || supportSubmissions[0],
    [selectedId]
  );

  const saveAnnotation = () => {
    setStatus("Annotation support enregistrée.");
  };

  return (
    <section className="space-y-5">
      <header className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase text-slate-400">Département support</p>
        <h1 className="mt-1 text-2xl font-black text-[#0F3A63]">Auto-évaluations support reçues</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Les membres du support soumettent directement aux associés. Les associés consultent ici avant le classement en comité.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#0F3A63]">Soumissions</h2>
          <div className="mt-4 space-y-2">
            {supportSubmissions.map((submission) => (
              <button
                key={submission.id}
                onClick={() => {
                  setSelectedId(submission.id);
                  setStatus("");
                }}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedSubmission.id === submission.id ? "border-[#76B82A] bg-[#EEF6E8]" : "border-slate-100 bg-[#F8FAFC] hover:bg-slate-100"
                }`}
              >
                <p className="text-sm font-extrabold text-[#0F3A63]">{submission.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{submission.email}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#0F4A72]">{submission.status}</span>
                  <span className="text-xs font-black text-[#76B82A]">{submission.average}/5</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#0F3A63]">{selectedSubmission.name}</h2>
              <p className="text-sm font-semibold text-slate-500">{selectedSubmission.role}</p>
            </div>
            <span className="rounded-full bg-[#DDECCF] px-3 py-1 text-xs font-bold text-[#4E8B1B]">
              Score {selectedSubmission.average}/5
            </span>
          </div>

          <div className="space-y-3">
            {selectedSubmission.answers.map(([label, score]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-4 py-3">
                <p className="text-sm font-bold text-[#0F3A63]">{label}</p>
                <p className="text-sm font-black text-[#76B82A]">{score}</p>
              </div>
            ))}
          </div>

          <section className="mt-5 rounded-lg bg-[#F8FAFC] p-4">
            <p className="text-xs font-bold uppercase text-slate-400">Commentaire support</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">{selectedSubmission.comment}</p>
          </section>

          <textarea
            value={annotation}
            onChange={(event) => {
              setAnnotation(event.target.value);
              setStatus("");
            }}
            placeholder="Annotation associée sur cette auto-évaluation support..."
            className="mt-5 min-h-[120px] w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm text-[#0F3A63] outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {status ? <p className="text-sm font-bold text-[#4E8B1B]">{status}</p> : null}
            <button onClick={saveAnnotation} className="rounded-full bg-[#0F3A63] px-5 py-2 text-sm font-bold text-white">
              Enregistrer l'annotation
            </button>
          </div>
        </article>
      </section>
    </section>
  );
}

export default AutoevaluationSupport;
