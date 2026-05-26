import { useEffect, useMemo, useState } from "react";
import { committeeAssistants, committeeLeaders, committeeLevels, committeeMembers, committeeSupport } from "@/components/pages/comite/comiteData";
import { getCommitteeParticipants, getLatestCommitteeDecision } from "@/lib/committee";

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
  classifiableLabel = "Collaborateurs à classer",
  lockPrimaryClassification = false,
  primaryUnclassified = false,
  participantScope = "collaborators",
  readOnly = false,
  rateEnabled = false,
  secondaryParticipantScope = null,
  secondaryUnclassified = false,
  tertiaryParticipantScope = null,
  tertiaryUnclassified = false,
  showSubmit = true,
  showCommitteeMembers = true,
  initialDecisionScope = null,
  editableDecisionScope = null,
  submitLabel = "Transmettre aux associés",
  submittedLabel = "Transmis aux associés",
  successMessage = "Classement transmis.",
  workflowText,
  onSubmit,
}) {
  const fallbackParticipants = useMemo(() => {
    const primaryFallback =
      participantScope === "none" ? [] : participantScope === "leadership" ? committeeLeaders : participantScope === "support" ? committeeSupport : committeeAssistants;
    const secondaryFallback = secondaryParticipantScope === "leadership" ? committeeLeaders : [];
    const tertiaryFallback = tertiaryParticipantScope === "support" ? committeeSupport : [];

    return [
      ...primaryFallback.map((person) => ({
        ...person,
        level: primaryUnclassified ? null : person.level,
        lockedClassification: lockPrimaryClassification,
      })),
      ...secondaryFallback.map((person) => ({ ...person, level: secondaryUnclassified ? null : person.level })),
      ...tertiaryFallback.map((person) => ({ ...person, level: tertiaryUnclassified ? null : person.level })),
    ];
  }, [lockPrimaryClassification, participantScope, primaryUnclassified, secondaryParticipantScope, secondaryUnclassified, tertiaryParticipantScope, tertiaryUnclassified]);

  const [people, setPeople] = useState(fallbackParticipants);
  const [committeeMemberNames, setCommitteeMemberNames] = useState(committeeMembers);
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
      scope === "none"
        ? Promise.resolve([])
        :
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
      loadScope(participantScope, { lockedClassification: lockPrimaryClassification, unclassified: primaryUnclassified }),
      secondaryParticipantScope ? loadScope(secondaryParticipantScope, { unclassified: secondaryUnclassified }) : Promise.resolve([]),
      tertiaryParticipantScope ? loadScope(tertiaryParticipantScope, { unclassified: tertiaryUnclassified }) : Promise.resolve([]),
      getCommitteeParticipants("committee").catch(() => ({ participants: [] })),
      initialDecisionScope ? getLatestCommitteeDecision(initialDecisionScope).catch(() => ({ decision: null })) : Promise.resolve({ decision: null }),
      editableDecisionScope ? getLatestCommitteeDecision(editableDecisionScope).catch(() => ({ decision: null })) : Promise.resolve({ decision: null }),
    ])
      .then(([primaryParticipants, secondaryParticipants, tertiaryParticipants, committeeData, latestInitialDecisionData, latestEditableDecisionData]) => {
        if (ignore) return;

        const decisionSources = [latestInitialDecisionData?.decision, latestEditableDecisionData?.decision].filter(Boolean);
        const decisionLevelById = new Map();

        decisionSources.forEach((decision) => {
          committeeLevels.forEach((level) => {
            const participants = Array.isArray(decision?.decisions?.[level.key]) ? decision.decisions[level.key] : [];
            participants.forEach((participant) => {
              if (!participant?.id) {
                return;
              }

              decisionLevelById.set(participant.id, {
                level: level.key,
                increaseRate: participant.increaseRate || "",
              });
            });
          });
        });

        const primaryParticipantsWithDecision = primaryParticipants.length
          ? primaryParticipants.map((participant) => {
              const savedDecision = decisionLevelById.get(participant.id);

              if (!savedDecision) {
                return participant;
              }

              return {
                ...participant,
                level: savedDecision.level,
                increaseRate: savedDecision.increaseRate,
                lockedClassification: Boolean(lockPrimaryClassification),
              };
            })
          : decisionSources.length
            ? committeeLevels.flatMap((level) =>
                decisionSources.flatMap((decision) =>
                  Array.isArray(decision?.decisions?.[level.key])
                    ? decision.decisions[level.key].map((participant) => ({
                        ...participant,
                        increaseRate: participant.increaseRate || "",
                        level: level.key,
                        lockedClassification: Boolean(lockPrimaryClassification),
                      }))
                    : []
                )
              )
            : [];

        const applySavedDecision = (participants, options = {}) =>
          participants.map((participant) => {
            const savedDecision = decisionLevelById.get(participant.id);

            if (!savedDecision) {
              return participant;
            }

            return {
              ...participant,
              level: savedDecision.level,
              increaseRate: savedDecision.increaseRate,
              lockedClassification: Boolean(options.lockedClassification),
            };
          });

        const secondaryParticipantsWithDecision = applySavedDecision(secondaryParticipants);
        const tertiaryParticipantsWithDecision = applySavedDecision(tertiaryParticipants);

        const participantMap = new Map();
        [...primaryParticipantsWithDecision, ...secondaryParticipantsWithDecision, ...tertiaryParticipantsWithDecision].forEach((participant) => {
          if (!participant?.id) {
            return;
          }

          const existingParticipant = participantMap.get(participant.id);
          participantMap.set(participant.id, {
            ...existingParticipant,
            ...participant,
            lockedClassification: Boolean(existingParticipant?.lockedClassification || participant.lockedClassification),
          });
        });
        const loadedParticipants = Array.from(participantMap.values());
        if (Array.isArray(committeeData?.participants) && committeeData.participants.length) {
          setCommitteeMemberNames(Array.from(new Set(committeeData.participants.map((participant) => participant.name).filter(Boolean))));
        } else {
          setCommitteeMemberNames(committeeMembers);
        }

        if (loadedParticipants.length) {
          setPeople(loadedParticipants);
        }
        setLoadStatus("");
      })
      .catch(() => {
        if (!ignore) {
          setCommitteeMemberNames(committeeMembers);
          setLoadStatus("Liste de secours affichee.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [
    fallbackParticipants,
    lockPrimaryClassification,
    participantScope,
    primaryUnclassified,
    secondaryParticipantScope,
    secondaryUnclassified,
    tertiaryParticipantScope,
    tertiaryUnclassified,
    initialDecisionScope,
    editableDecisionScope,
  ]);

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
              {workflowText || `${actorLabel} positionne les personnes dans la bulle de décision retenue pendant le comité.`}
            </p>
          </div>
        </div>

        {showCommitteeMembers ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {committeeMemberNames.map((member) => (
              <span key={member} className="rounded-full bg-[#F3F6F8] px-3 py-1 text-xs font-bold text-[#0F4A72]">
                {member}
              </span>
            ))}
          </div>
        ) : null}
      </article>

      <aside onDrop={(event) => onDrop(event, null)} onDragOver={onDragOver} className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-lg font-extrabold text-[#0F3A63]">{classifiableLabel}</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {readOnly
            ? "Classement visible par le comité."
            : allowClassification
              ? "Glissez un nom vers CA, CB, CC ou CD."
              : "Classement verrouillé : renseignez uniquement les taux."}
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
