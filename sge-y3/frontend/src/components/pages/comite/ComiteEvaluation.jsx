// import { useEffect, useMemo, useState } from "react";
// import { committeeAssistants, committeeLevels, committeeMembers } from "@/components/pages/comite/comiteData";
// import { getCommitteeParticipants } from "@/lib/committee";

// function AssistantCard({ assistant, draggable, onDragStart, compact = false }) {
//   return (
//     <article
//       draggable={draggable}
//       onDragStart={(event) => onDragStart(event, assistant.id)}
//       className={`rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm ${
//         draggable ? "cursor-grab active:cursor-grabbing" : ""
//       }`}
//     >
//       <h4 className="text-center text-sm font-extrabold text-[#0F3A63]">{assistant.name}</h4>
//       {!compact && assistant.role ? <p className="mt-1 text-center text-xs font-semibold text-slate-500">{assistant.role}</p> : null}
//     </article>
//   );
// }

// function ComiteEvaluation({ readOnly = false }) {
//   const [assistants, setAssistants] = useState(committeeAssistants);
//   const [draggedId, setDraggedId] = useState(null);
//   const [status, setStatus] = useState("");
//   const [loadStatus, setLoadStatus] = useState("");

//   useEffect(() => {
//     let ignore = false;

//     getCommitteeParticipants()
//       .then((data) => {
//         if (ignore || !Array.isArray(data.participants) || !data.participants.length) return;
//         setAssistants(data.participants);
//         setLoadStatus("");
//       })
//       .catch(() => {
//         if (!ignore) {
//           setLoadStatus("Liste de secours affichee.");
//         }
//       });

//     return () => {
//       ignore = true;
//     };
//   }, []);

//   const groupedAssistants = useMemo(
//     () =>
//       committeeLevels.reduce((groups, level) => {
//         groups[level.key] = assistants.filter((assistant) => assistant.level === level.key);
//         return groups;
//       }, {}),
//     [assistants]
//   );

//   const onDragStart = (event, assistantId) => {
//     if (readOnly) return;
//     event.dataTransfer.setData("text/plain", assistantId);
//     setDraggedId(assistantId);
//     setStatus("");
//   };

//   const onDrop = (event, levelKey) => {
//     event.preventDefault();
//     if (readOnly) return;

//     const assistantId = event.dataTransfer.getData("text/plain") || draggedId;
//     const movedAssistant = assistants.find((assistant) => assistant.id === assistantId);
//     if (!movedAssistant) return;

//     setAssistants((currentAssistants) =>
//       currentAssistants.map((assistant) => (assistant.id === assistantId ? { ...assistant, level: levelKey } : assistant))
//     );
//     setDraggedId(null);
//     setStatus(`${movedAssistant.name} classe en ${levelKey}.`);
//   };

//   const onDragOver = (event) => {
//     if (!readOnly) event.preventDefault();
//   };

//   const summary = committeeLevels.map((level) => ({
//     ...level,
//     count: groupedAssistants[level.key]?.length || 0,
//   }));

//   return (
//     <section className="space-y-5">
//       <article className="rounded-xl bg-white p-5 shadow-sm">
//         <div className="flex flex-wrap items-start justify-between gap-4">
//           <div>
//             <p className="text-xs font-bold uppercase text-slate-400">Comite RH - Managers - Associes</p>
//             {/* <h2 className="mt-1 text-2xl font-black text-[#0F3A63]">
//               Comite d'evaluation (CA = maintenu, CB = Passable, CC = Bien, CD = Excellent)
//             </h2> */}
//             <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">
//               La RH positionne chaque assistant dans la bulle de decision retenue pendant le comite.
//             </p>
//           </div>
//           <span className={`rounded-full px-4 py-2 text-xs font-bold ${readOnly ? "bg-[#E7EDF3] text-[#0F4A72]" : "bg-[#DDECCF] text-[#4E8B1B]"}`}>
//             {readOnly ? "Consultation" : "Glisser-deposer actif"}
//           </span>
//         </div>

//         <div className="mt-5 flex flex-wrap gap-2">
//           {committeeMembers.map((member) => (
//             <span key={member} className="rounded-full bg-[#F3F6F8] px-3 py-1 text-xs font-bold text-[#0F4A72]">
//               {member}
//             </span>
//           ))}
//         </div>
//       </article>

//       <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
//         {summary.map((level) => (
//           <article
//             key={level.key}
//             className={`flex min-h-[150px] flex-col items-center justify-center rounded-full border p-5 text-center ${level.tone}`}
//           >
//             <p className="text-2xl font-black uppercase leading-none">{level.label}</p>
//             <p className="mt-2 text-base font-black">{level.title}</p>
//             <p className="mt-2 text-xs font-semibold opacity-80">{level.count} personne(s)</p>
//           </article>
//         ))}
//       </section>

//       <section className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">
//         <aside className="rounded-xl bg-white p-4 shadow-sm">
//           <h3 className="text-lg font-extrabold text-[#0F3A63]">Collaborateurs a classer</h3>
//           <p className="mt-1 text-xs font-semibold text-slate-500">
//             {readOnly ? "Classement visible par le comite." : "Glissez une fiche vers une bulle CA, CB, CC ou CD."}
//           </p>
//           {loadStatus ? <p className="mt-2 text-xs font-bold text-slate-400">{loadStatus}</p> : null}
//           <div className="mt-4 space-y-3">
//             {assistants.map((assistant) => (
//               <AssistantCard key={assistant.id} assistant={assistant} compact draggable={!readOnly} onDragStart={onDragStart} />
//             ))}
//           </div>
//         </aside>

//         <div className="grid min-h-[620px] grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
//           {committeeLevels.map((level) => (
//             <section
//               key={level.key}
//               onDrop={(event) => onDrop(event, level.key)}
//               onDragOver={onDragOver}
//               className={`flex min-h-[560px] flex-col rounded-[32px] border-2 border-dashed px-4 py-6 text-center transition ${level.tone} ${
//                 draggedId && !readOnly ? "ring-2 ring-[#0D496A]/20" : ""
//               }`}
//             >
//               <div className="mb-4 flex flex-col items-center gap-3">
//                 <div>
//                   <p className="text-3xl font-black leading-none">{level.label}</p>
//                   <h3 className="mt-1 text-lg font-black">{level.title}</h3>
//                   <p className="mx-auto mt-2 max-w-[220px] text-xs font-semibold opacity-80">{level.description}</p>
//                 </div>
//                 <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black">{groupedAssistants[level.key]?.length || 0}</span>
//               </div>

//               <div className="mx-auto mt-4 w-full space-y-3">
//                 {groupedAssistants[level.key]?.length ? (
//                   groupedAssistants[level.key].map((assistant) => (
//                     <AssistantCard key={assistant.id} assistant={assistant} draggable={!readOnly} onDragStart={onDragStart} />
//                   ))
//                 ) : (
//                   <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-white/70 bg-white/50 px-5 text-sm font-bold opacity-80">
//                     Deposez un assistant ici
//                   </div>
//                 )}
//               </div>
//             </section>
//           ))}
//         </div>
//       </section>

//       {status ? <p className="text-right text-sm font-bold text-[#4E8B1B]">{status}</p> : null}
//     </section>
//   );
// }

// export default ComiteEvaluation;
import { useEffect, useMemo, useState } from "react";
import { committeeAssistants, committeeLevels, committeeMembers } from "@/components/pages/comite/comiteData";
import { getCommitteeParticipants } from "@/lib/committee";

function AssistantCard({ assistant, draggable, onDragStart, compact = false, small = false }) {
  return (
    <article
      draggable={draggable}
      onDragStart={(event) => onDragStart(event, assistant.id)}
      className={`rounded-full border border-slate-200 bg-white shadow-sm ${
        small ? "px-2 py-1" : "px-4 py-3"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <h4 className={`text-center font-extrabold text-[#0F3A63] ${small ? "text-[10px]" : "text-sm"}`}>
        {assistant.name}
      </h4>
      {!compact && !small && assistant.role ? (
        <p className="mt-1 text-center text-xs font-semibold text-slate-500">{assistant.role}</p>
      ) : null}
    </article>
  );
}

function ComiteEvaluation({ readOnly = false, onSubmit }) {
  const [assistants, setAssistants] = useState(committeeAssistants);
  const [draggedId, setDraggedId] = useState(null);
  const [status, setStatus] = useState("");
  const [loadStatus, setLoadStatus] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const result = committeeLevels.reduce((acc, level) => {
      acc[level.key] = assistants.filter((a) => a.level === level.key);
      return acc;
    }, {});
    setSubmitted(true);
    setStatus("Classement soumis aux associes.");
    if (onSubmit) onSubmit(result);
  };

  useEffect(() => {
    let ignore = false;

    getCommitteeParticipants()
      .then((data) => {
        if (ignore || !Array.isArray(data.participants) || !data.participants.length) return;
        setAssistants(data.participants);
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
  }, []);

  const groupedAssistants = useMemo(
    () =>
      committeeLevels.reduce((groups, level) => {
        groups[level.key] = assistants.filter((assistant) => assistant.level === level.key);
        return groups;
      }, {}),
    [assistants]
  );

  const levelKeys = new Set(committeeLevels.map((l) => l.key));
  const unclassedAssistants = assistants.filter((assistant) => !levelKeys.has(assistant.level));

  const onDragStart = (event, assistantId) => {
    if (readOnly) return;
    event.dataTransfer.setData("text/plain", assistantId);
    setDraggedId(assistantId);
    setStatus("");
  };

  const onDrop = (event, levelKey) => {
    event.preventDefault();
    if (readOnly) return;

    const assistantId = event.dataTransfer.getData("text/plain") || draggedId;
    const movedAssistant = assistants.find((assistant) => assistant.id === assistantId);
    if (!movedAssistant) return;

    setAssistants((currentAssistants) =>
      currentAssistants.map((assistant) => (assistant.id === assistantId ? { ...assistant, level: levelKey ?? null } : assistant))
    );
    setDraggedId(null);
    setStatus(levelKey ? `${movedAssistant.name} classe en ${levelKey}.` : `${movedAssistant.name} remis dans la liste.`);
  };

  const onDragOver = (event) => {
    if (!readOnly) event.preventDefault();
  };

  // Bulles de résumé désactivées — décommenter pour réactiver
  // const summary = committeeLevels.map((level) => ({
  //   ...level,
  //   count: groupedAssistants[level.key]?.length || 0,
  // }));

  return (
    <section className="space-y-5">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Comite RH - Managers - Associes</p>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">
              La RH positionne chaque assistant dans la bulle de decision retenue pendant le comite.
            </p>
          </div>
          <span className={`rounded-full px-4 py-2 text-xs font-bold ${readOnly ? "bg-[#E7EDF3] text-[#0F4A72]" : "bg-[#DDECCF] text-[#4E8B1B]"}`}>
            {readOnly ? "Consultation" : "Glisser-deposer actif"}
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

      {/* Bulles de résumé désactivées — décommenter pour réactiver */}
      {/* <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {summary.map((level) => (
          <article
            key={level.key}
            className={`flex min-h-[150px] flex-col items-center justify-center rounded-full border p-5 text-center ${level.tone}`}
          >
            <p className="text-2xl font-black uppercase leading-none">{level.label}</p>
            <p className="mt-2 text-base font-black">{level.title}</p>
            <p className="mt-2 text-xs font-semibold opacity-80">{level.count} personne(s)</p>
          </article>
        ))}
      </section> */}

      {/* Liste des collaborateurs en haut */}
      <aside onDrop={(event) => onDrop(event, null)} onDragOver={onDragOver} className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-lg font-extrabold text-[#0F3A63]">Collaborateurs a classer</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {readOnly ? "Classement visible par le comite." : "Glissez une fiche vers une bulle CA, CB, CC ou CD."}
        </p>
        {loadStatus ? <p className="mt-2 text-xs font-bold text-slate-400">{loadStatus}</p> : null}
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {unclassedAssistants.map((assistant) => (
            <AssistantCard key={assistant.id} assistant={assistant} compact small draggable={!readOnly} onDragStart={onDragStart} />
          ))}
        </div>
      </aside>

      {/* Colonnes en grille 2x2 — hauteur fixe, scroll interne */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {committeeLevels.map((level) => (
          <section
            key={level.key}
            onDrop={(event) => onDrop(event, level.key)}
            onDragOver={onDragOver}
            className={`flex h-[320px] flex-col rounded-[32px] border-2 border-dashed px-4 py-5 text-center transition ${level.tone} ${
              draggedId && !readOnly ? "ring-2 ring-[#0D496A]/20" : ""
            }`}
          >
            <div className="mb-3 flex shrink-0 flex-col items-center gap-1">
              <p className="text-2xl font-black leading-none">{level.label}</p>
              <h3 className="text-sm font-black">{level.title}</h3>
              <span className="rounded-full bg-white/80 px-3 py-0.5 text-xs font-black">{groupedAssistants[level.key]?.length || 0}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-1.5 pb-2">
                {groupedAssistants[level.key]?.length ? (
                  groupedAssistants[level.key].map((assistant) => (
                    <AssistantCard key={assistant.id} assistant={assistant} small draggable={!readOnly} onDragStart={onDragStart} />
                  ))
                ) : (
                  <div className="flex h-[160px] items-center justify-center rounded-[24px] border border-white/70 bg-white/50 px-5 text-xs font-bold opacity-70">
                    Deposez un assistant ici
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitted}
            className={`rounded-full px-6 py-3 text-sm font-extrabold shadow-sm transition ${
              submitted
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-[#0F3A63] text-white hover:bg-[#0D496A] active:scale-95"
            }`}
          >
            {submitted ? "Soumis aux associes ✓" : "Soumettre aux associes"}
          </button>
        </div>
      )}

      {status ? <p className="text-right text-sm font-bold text-[#4E8B1B]">{status}</p> : null}
    </section>
  );
}

export default ComiteEvaluation;