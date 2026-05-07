import { useState } from "react";

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

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ScoreButtons({ label, selected, onSelect }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[#0F3A63]">{label}</p>
      <div className="flex overflow-hidden rounded-md border border-slate-200">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={`${label}-${value}`}
            onClick={() => onSelect(value)}
            className={`h-9 w-10 border-r border-slate-200 text-sm font-semibold last:border-r-0 ${
              value === selected ? "bg-[#003B63] text-white" : "bg-slate-50 text-[#0F3A63]"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function Evaluermonequipe({ member }) {
  const [technicalScore, setTechnicalScore] = useState(4);
  const [behaviorScore, setBehaviorScore] = useState(2);
  const [goalsScore, setGoalsScore] = useState(4);
  const [meetingMode, setMeetingMode] = useState("Presentiel");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [gapJustification, setGapJustification] = useState("");

  const collaborator = member || {
    name: "Yasmine K",
    role: "Senior",
    status: "En cours",
    score: "4.2 / 5",
  };
  const initials = getInitials(collaborator.name);
  const technicalPoints = technicalScore * 0.5;
  const behaviorPoints = behaviorScore * 0.3;
  const goalsPoints = goalsScore * 0.2;
  const finalScore = (technicalPoints + behaviorPoints + goalsPoints).toFixed(1);
  const technicalPercent = technicalScore * 20;
  const behaviorPercent = behaviorScore * 20;
  const goalsPercent = goalsScore * 20;
  const finalPercent = Math.round((Number(finalScore) / 5) * 100);
  const hasGap = Math.abs(3 - behaviorScore) >= 1;

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-slate-400">
        Evaluations - {collaborator.name} ({collaborator.role})
      </p>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                  {initials}
                </span>
                <div>
                  <p className="text-sm font-bold text-[#0F3A63]">{collaborator.name}</p>
                  <p className="text-xs text-slate-400">{collaborator.role}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 text-xs font-semibold">
              <span className="text-[#0F3A63]">Cycle 2026</span>
              <span className="rounded-full bg-[#DDECCF] px-2 py-1 text-[#4E8B1B]">{collaborator.status}</span>
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
            <select
              value={meetingMode}
              onChange={(event) => setMeetingMode(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            >
              <option>Presentiel</option>
              <option>Visio</option>
              <option>Telephone</option>
            </select>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow-sm md:col-span-2">
              <ScoreChip value={finalScore} label="Score pondere final" detail={`${finalPercent}% - Technique 50% / Savoir-etre 30% / Objectifs 20%`} />
              <div className="mt-5 space-y-3 text-sm font-semibold text-[#0F3A63]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Technique (50%)</span>
                  <span className="text-[#76B82A]">{technicalScore}/5 - {technicalPercent}% - {technicalPoints.toFixed(1)} pts</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Savoir-etre (30%)</span>
                  <span className={behaviorScore < 3 ? "text-[#E53935]" : "text-[#76B82A]"}>
                    {behaviorScore}/5 - {behaviorPercent}% - {behaviorPoints.toFixed(1)} pts
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Objectifs atteints (20%)</span>
                  <span className="text-[#76B82A]">{goalsScore}/5 - {goalsPercent}% - {goalsPoints.toFixed(1)} pts</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>Score total</span>
                  <span className="text-[#76B82A]">{finalScore} / 5 - {finalPercent}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-[#E3EFD8] p-4 shadow-sm">
              <p className="mb-1 text-sm font-bold text-[#76B82A]">Note annuelle</p>
              <p className="mb-4 text-xs text-slate-500">22/04/2026 - 14h30</p>
              <p className="mb-1 text-xs font-semibold text-[#0F3A63]">Notes de l'entretien</p>
              <textarea
                rows={5}
                value={meetingNotes}
                onChange={(event) => setMeetingNotes(event.target.value)}
                placeholder="Points abordes lors de l'entretien..."
                className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-[#0F3A63] outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-[#76B82A]">Evaluation Manager</p>
            <div
              className={`mb-4 rounded-sm px-3 py-2 text-xs font-semibold ${
                hasGap ? "bg-[#F4D6D8] text-[#A4252F]" : "bg-[#DCECCB] text-[#0F3A63]"
              }`}
            >
              {hasGap
                ? `Ecart detecte sur Savoir-etre : auto-eval 3/5, votre note ${behaviorScore}/5. Un commentaire est requis.`
                : "Les notes saisies sont coherentes avec l'auto-evaluation du collaborateur."}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
              <ScoreButtons label="Competences techniques" selected={technicalScore} onSelect={setTechnicalScore} />
              <ScoreButtons label="Savoir-etre" selected={behaviorScore} onSelect={setBehaviorScore} />
              <ScoreButtons label="Objectifs atteints" selected={goalsScore} onSelect={setGoalsScore} />
            </div>

            {hasGap ? (
              <div className="mb-4 rounded-sm bg-[#F4D6D8] px-3 py-2 text-xs font-semibold text-[#A4252F]">
                Ecart detecte - justification obligatoire
              </div>
            ) : null}

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="mb-2 text-xs font-semibold text-[#0F3A63]">Justification de l'ecart</p>
              <textarea
                rows={3}
                value={gapJustification}
                onChange={(event) => setGapJustification(event.target.value)}
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
