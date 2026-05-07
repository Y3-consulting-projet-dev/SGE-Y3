import { useState } from "react";
import { assistantEvaluations } from "@/components/pages/senior/seniorData";

function MissionScoreRow({ item }) {
  const gap = Math.abs(item.assistant - item.senior);

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
      <div>
        <p className="text-sm font-bold text-[#0F3A63]">{item.label}</p>
        {gap >= 2 ? <p className="mt-1 text-xs font-semibold text-[#A4252F]">Ecart a justifier</p> : null}
      </div>
      <span className="text-xs font-bold text-slate-500">Retour assistant: {item.assistant}/5</span>
      <div className="flex overflow-hidden rounded-md border border-slate-200">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={`${item.label}-${score}`}
            className={`h-8 w-9 border-r border-slate-200 text-xs font-bold last:border-0 ${
              item.senior === score ? "bg-[#003B63] text-white" : "bg-white text-[#0F3A63]"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function Evaluerassistants() {
  const [status, setStatus] = useState("");
  const [selectedAssistant, setSelectedAssistant] = useState(assistantEvaluations[0].name);
  const [selectedMission, setSelectedMission] = useState(0);
  const [missionName, setMissionName] = useState("");
  const [savedMissions, setSavedMissions] = useState([]);
  const currentAssistant = assistantEvaluations.find((assistant) => assistant.name === selectedAssistant) || assistantEvaluations[0];
  const currentMission = currentAssistant.missions[selectedMission] || currentAssistant.missions[0];
  const allScores = currentAssistant.missions.flatMap((mission) => mission.criteria.map((criterion) => criterion.senior));
  const averageScore = (allScores.reduce((total, score) => total + score, 0) / allScores.length).toFixed(1);
  const hasGap = currentMission.criteria.some((criterion) => Math.abs(criterion.assistant - criterion.senior) >= 2);

  const selectAssistant = (name) => {
    setSelectedAssistant(name);
    setSelectedMission(0);
    setMissionName("");
    setStatus("");
  };

  const saveMission = (nextStatus) => {
    const trimmedMission = missionName.trim();

    if (!trimmedMission) {
      setStatus("missing-mission");
      return;
    }

    setSavedMissions((missions) => [
      {
        id: `${Date.now()}-${trimmedMission}`,
        assistant: currentAssistant.name,
        role: currentAssistant.role,
        mission: trimmedMission,
        score: averageScore,
        manager: currentAssistant.manager,
        status: nextStatus,
      },
      ...missions,
    ]);
    setStatus(nextStatus);
    setMissionName("");
  };

  return (
    <section className="space-y-5">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <label htmlFor="assistant-select" className="mb-2 block text-xs font-bold text-[#0F3A63]">
              Assistant a evaluer
            </label>
            <select
              id="assistant-select"
              value={selectedAssistant}
              onChange={(event) => selectAssistant(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            >
              {assistantEvaluations.map((assistant) => (
                <option key={assistant.name} value={assistant.name}>
                  {assistant.name} - {assistant.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mission-name" className="mb-2 block text-xs font-bold text-[#0F3A63]">
              Mission a evaluer
            </label>
            <input
              id="mission-name"
              type="text"
              value={missionName}
              onChange={(event) => {
                setMissionName(event.target.value);
                setStatus("");
              }}
              placeholder="Saisir le type ou le nom de la mission"
              className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0F3A63] outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-[#4E8B1B]">{currentAssistant.status}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{currentAssistant.missions.length} mission(s) commune(s)</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Manager: {currentAssistant.manager}</span>
        </div>
      </article>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-5">
          <article className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8BC53F] text-sm font-extrabold text-white">
                {currentAssistant.initials}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#0F3A63]">{currentAssistant.name}</h2>
                <p className="text-sm font-semibold text-slate-500">{currentAssistant.role} - Cycle 2026</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold text-[#0F3A63]">Manager final</span>
                <span className="font-bold text-slate-500">{currentAssistant.manager}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#0F3A63]">Entretien prevu</span>
                <span className="font-bold text-[#76B82A]">{currentAssistant.interview}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#0F3A63]">Score Senior</span>
                <span className="font-bold text-[#76B82A]">{averageScore} / 5</span>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-[#DCECCB] p-4 text-sm font-semibold text-[#184D2E]">
              Le Senior evalue l'assistant sur les missions menees ensemble. La validation finale reste cote Manager.
            </div>
          </article>

          <article className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-[#0F3A63]">Missions communes de l'assistant</h2>
            <div className="space-y-3">
              {currentAssistant.missions.map((mission, index) => (
                <button
                  key={mission.title}
                  onClick={() => {
                    setSelectedMission(index);
                    setMissionName(mission.title);
                    setStatus("");
                  }}
                  className={`w-full rounded-lg p-4 text-left transition ${
                    selectedMission === index ? "bg-[#DFECD4]" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-sm font-extrabold text-[#0F3A63]">{mission.title}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4E8B1B]">{mission.result}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">{mission.period}</p>
                  <p className="mt-1 text-xs font-semibold text-[#0F3A63]">{mission.seniorRole}</p>
                </button>
              ))}
            </div>
          </article>
        </div>

        <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400">Evaluation selon la mission faite ensemble</p>
              <h2 className="text-xl font-extrabold text-[#0F3A63]">
                {missionName.trim() || "Renseigner la mission a evaluer"}
              </h2>
            </div>
            <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-xs font-bold text-[#4E8B1B]">{currentMission.period}</span>
          </div>

          <div className="mb-4 rounded-lg bg-[#DCECCB] p-4 text-sm font-semibold text-[#184D2E]">
            {currentMission.context}
          </div>

          <div className="mb-4 rounded-lg bg-slate-50 p-4">
            <p className="mb-2 text-xs font-bold text-[#79B742]">Faits observes pendant la mission</p>
            <div className="space-y-2">
              {currentMission.facts.map((fact) => (
                <p key={fact} className="text-sm font-semibold text-[#0F3A63]">
                  {fact}
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {currentMission.criteria.map((item) => (
              <MissionScoreRow key={item.label} item={item} />
            ))}
          </div>

          {hasGap ? (
            <div className="mt-5 rounded-lg bg-[#F4D6D8] px-4 py-3 text-xs font-semibold text-[#A4252F]">
              Ecart detecte entre le retour de l'assistant et l'avis Senior. Une justification est requise avant transmission.
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-[#DCECCB] px-4 py-3 text-xs font-semibold text-[#184D2E]">
              Les notes Senior sont coherentes avec les faits observes sur cette mission.
            </div>
          )}

          <textarea
            rows={4}
            placeholder="Avis Senior sur la mission, faits observes, points forts, axes de progres..."
            className="mt-4 w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#0F3A63] outline-none placeholder:text-slate-400"
          />

          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="mb-3 text-xs font-bold text-[#79B742]">Synthese pour le Manager</p>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Missions evaluees</p>
                <p className="font-extrabold text-[#0F3A63]">{currentAssistant.missions.length}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Score moyen</p>
                <p className="font-extrabold text-[#76B82A]">{averageScore} / 5</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Statut avis</p>
                <p className="font-extrabold text-[#F34D4D]">A valider</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button onClick={() => saveMission("draft")} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-bold text-[#0F3A63]">
              Enregistrer brouillon
            </button>
            <button onClick={() => saveMission("sent")} className="rounded-md bg-[#76B82A] px-5 py-2 text-sm font-bold text-white">
              Transmettre au Manager
            </button>
          </div>
          {status ? (
            <p className={`mt-3 text-right text-xs font-bold ${status === "missing-mission" ? "text-[#A4252F]" : "text-[#76B82A]"}`}>
              {status === "missing-mission"
                ? "Saisissez une mission avant d'enregistrer."
                : status === "sent"
                  ? "Evaluation transmise au Manager."
                  : "Brouillon enregistre."}
            </p>
          ) : null}
        </article>
      </section>

      <article className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-[#0F3A63]">Missions saisies</h2>
        {savedMissions.length ? (
          <div className="space-y-3">
            {savedMissions.map((mission) => (
              <div key={mission.id} className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-extrabold text-[#0F3A63]">{mission.mission}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {mission.assistant} - {mission.role} - Manager: {mission.manager}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="rounded-full bg-[#DCECCB] px-3 py-1 text-[#4E8B1B]">Score {mission.score} / 5</span>
                  <span className={`rounded-full px-3 py-1 ${mission.status === "sent" ? "bg-[#76B82A] text-white" : "bg-slate-200 text-[#0F3A63]"}`}>
                    {mission.status === "sent" ? "Transmise au Manager" : "Brouillon"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Aucune mission enregistree pour le moment.
          </p>
        )}
      </article>
    </section>
  );
}

export default Evaluerassistants;
