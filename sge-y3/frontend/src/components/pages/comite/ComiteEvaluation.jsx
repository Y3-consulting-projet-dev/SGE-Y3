import { useEffect, useMemo, useState } from "react";
import { committeeAssistants, committeeLeaders, committeeLevels, committeeMembers } from "@/components/pages/comite/comiteData";
import { getCommitteeParticipants } from "@/lib/committee";

function PersonCard({ person, draggable, onDragStart, onRateChange, compact = false, rateEnabled = false }) {
  return (
    <article
      draggable={draggable}
      onDragStart={(event) => onDragStart(event, person.id)}
      className={`rounded-[18px] border border-slate-200 bg-white px-3 py-2 shadow-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <h4 className="text-center text-xs font-extrabold text-[#0F3A63]">{person.name}</h4>
      {!compact && person.role ? <p className="mt-1 text-center text-[11px] font-semibold text-slate-500">{person.role}</p> : null}
      {rateEnabled ? (
        <label className="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold text-[#0F4A72]">
          <span>Taux</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={person.increaseRate ?? ""}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => onRateChange(person.id, event.target.value)}
            className="h-7 w-16 rounded-full border border-slate-200 bg-[#F8FAFC] px-2 text-center text-xs font-black text-[#0F3A63] outline-none"
          />
          <span>%</span>
        </label>
      ) : null}
    </article>
  );
}

function ComiteEvaluation({
  actorLabel = "La RH",
  allowClassification = true,
  classifiableLabel = "Collaborateurs a classer",
  lockPrimaryClassification = false,
  participantScope = "collaborators",
  readOnly = false,
  rateEnabled = false,
  secondaryParticipantScope = null,
  secondaryUnclassified = false,
  showSubmit = true,
  submitLabel = "Transmettre aux associes",
  submittedLabel = "Transmis aux associes",
  successMessage = "Classement transmis.",
  workflowText,
  onSubmit,
}) {
  const fallbackParticipants = useMemo(() => {
    const primaryFallback = participantScope === "leadership" ? committeeLeaders : committeeAssistants;
    const secondaryFallback = secondaryParticipantScope === "leadership" ? committeeLeaders : [];

    return [
      ...primaryFallback.map((person) => ({ ...person, lockedClassification: lockPrimaryClassification })),
      ...secondaryFallback.map((person) => ({ ...person, level: secondaryUnclassified ? null : person.level })),
    ];
  }, [lockPrimaryClassification, participantScope, secondaryParticipantScope, secondaryUnclassified]);
  const [people, setPeople] = useState(fallbackParticipants);
  const [draggedId, setDraggedId] = useState(null);
  const [status, setStatus] = useState("");
  const [loadStatus, setLoadStatus] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const canClassify = !readOnly && allowClassification;

  useEffect(() => {
    let ignore = false;

    setPeople(fallbackParticipants);
    setSubmitted(false);
    setStatus("");

    const loadScope = (scope, options = {}) =>
      getCommitteeParticipants(scope).then((data) =>
        Array.isArray(data.participants)
          ? data.participants.map((participant) => ({
              ...participant,
              increaseRate: participant.increaseRate || "",
              level: options.unclassified ? null : participant.level,
              lockedClassification: Boolean(options.lockedClassification),
            }))
          : []
      );

    Promise.all([
      loadScope(participantScope, { lockedClassification: lockPrimaryClassification }),
      secondaryParticipantScope ? loadScope(secondaryParticipantScope, { unclassified: secondaryUnclassified }) : Promise.resolve([]),
    ])
      .then(([primaryParticipants, secondaryParticipants]) => {
        if (ignore) return;
        const loadedParticipants = [...primaryParticipants, ...secondaryParticipants];
        if (!loadedParticipants.length) return;
        setPeople(loadedParticipants);
        setLoadStatus("");
      })
      .catch(() => {
        if (!ignore) {
          setLoadStatus("Liste de secours affichee.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [fallbackParticipants, lockPrimaryClassification, participantScope, secondaryParticipantScope, secondaryUnclassified]);

  const groupedPeople = useMemo(
    () =>
      committeeLevels.reduce((groups, level) => {
        groups[level.key] = people.filter((person) => person.level === level.key);
        return groups;
      }, {}),
    [people]
  );

  const levelKeys = useMemo(() => new Set(committeeLevels.map((level) => level.key)), []);
  const unclassedPeople = people.filter((person) => !levelKeys.has(person.level));

  const handleRateChange = (personId, increaseRate) => {
    setPeople((currentPeople) => currentPeople.map((person) => (person.id === personId ? { ...person, increaseRate } : person)));
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    const result = committeeLevels.reduce((acc, level) => {
      acc[level.key] = people.filter((person) => person.level === level.key);
      return acc;
    }, {});
    try {
      await onSubmit?.(result);
      setSubmitted(true);
      setStatus(successMessage);
    } catch (error) {
      setStatus(error.message || "Envoi impossible.");
    }
  };

  const onDragStart = (event, personId) => {
    if (!canClassify) return;
    event.dataTransfer.setData("text/plain", personId);
    setDraggedId(personId);
    setSubmitted(false);
  };

  const onDrop = (event, levelKey) => {
    event.preventDefault();
    if (!canClassify) return;

    const personId = event.dataTransfer.getData("text/plain") || draggedId;
    const movedPerson = people.find((person) => person.id === personId);
    if (!movedPerson || movedPerson.lockedClassification) return;

    setPeople((currentPeople) =>
      currentPeople.map((person) => (person.id === personId ? { ...person, level: levelKey ?? null } : person))
    );
    setDraggedId(null);
    setSubmitted(false);
  };

  const onDragOver = (event) => {
    if (canClassify) event.preventDefault();
  };

  return (
    <section className="space-y-5">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Comité RH - Managers - Associés</p>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">
              {workflowText || `${actorLabel} positionne les personnes dans la bulle de decision retenue pendant le comite.`}
            </p>
          </div>
          <span className={`rounded-full px-4 py-2 text-xs font-bold ${readOnly ? "bg-[#E7EDF3] text-[#0F4A72]" : "bg-[#DDECCF] text-[#4E8B1B]"}`}>
            {readOnly ? "Consultation" : rateEnabled && !allowClassification ? "Taux uniquement" : rateEnabled ? "Classement + taux" : "Glisser-deposer actif"}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {committeeMembers.map((member) => (
            <span key={member} className="rounded-full bg-[#F3F6F8] px-3 py-1 text-xs font-bold text-[#0F4A72]">
              {member}
            </span>
          ))}
        </div>
      </article>

      <aside onDrop={(event) => onDrop(event, null)} onDragOver={onDragOver} className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-lg font-extrabold text-[#0F3A63]">{classifiableLabel}</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {readOnly
            ? "Classement visible par le comite."
            : allowClassification
              ? "Glissez un nom vers CA, CB, CC ou CD."
              : "Classement verrouille : renseignez uniquement les taux."}
        </p>
        {loadStatus ? <p className="mt-2 text-xs font-bold text-slate-400">{loadStatus}</p> : null}
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {unclassedPeople.map((person) => (
            <PersonCard key={person.id} person={person} compact draggable={canClassify && !person.lockedClassification} onDragStart={onDragStart} />
          ))}
        </div>
      </aside>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {committeeLevels.map((level) => (
          <section
            key={level.key}
            onDrop={(event) => onDrop(event, level.key)}
            onDragOver={onDragOver}
            className={`flex h-[340px] flex-col rounded-[32px] border-2 border-dashed px-4 py-5 text-center transition ${level.tone} ${
              draggedId && canClassify ? "ring-2 ring-[#0D496A]/20" : ""
            }`}
          >
            <div className="mb-3 flex shrink-0 flex-col items-center gap-1">
              <p className="text-2xl font-black leading-none">{level.label}</p>
              <h3 className="text-sm font-black">{level.title}</h3>
              <span className="rounded-full bg-white/80 px-3 py-0.5 text-xs font-black">{groupedPeople[level.key]?.length || 0}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-1.5 pb-2">
                {groupedPeople[level.key]?.length ? (
                  groupedPeople[level.key].map((person) => (
                    <PersonCard
                      key={person.id}
                      person={person}
                      draggable={canClassify && !person.lockedClassification}
                      onDragStart={onDragStart}
                      onRateChange={handleRateChange}
                      rateEnabled={rateEnabled}
                    />
                  ))
                ) : (
                  <div className="flex h-[170px] items-center justify-center rounded-[24px] border border-white/70 bg-white/50 px-5 text-xs font-bold opacity-70">
                    Déposez un nom ici
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {!readOnly && showSubmit ? (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitted}
            className={`rounded-full px-6 py-3 text-sm font-extrabold shadow-sm transition ${
              submitted ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-[#0F3A63] text-white hover:bg-[#0D496A] active:scale-95"
            }`}
          >
            {submitted ? submittedLabel : submitLabel}
          </button>
        </div>
      ) : null}

      {status ? <p className="text-right text-sm font-bold text-[#4E8B1B]">{status}</p> : null}
    </section>
  );
}

export default ComiteEvaluation;
