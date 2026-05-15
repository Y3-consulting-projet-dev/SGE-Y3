import { useEffect, useMemo, useState } from "react";
import { getRhDepartmentEvaluations, selectRhDepartmentEvaluation } from "@/lib/rhOverview";

function statusClass(status) {
  if (status === "Validé" || status === "Valide" || status === "Pret Associe") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "Ecart a arbitrer") return "bg-[#F9DFDF] text-[#B63232]";
  if (status === "A completer") return "bg-[#FFF2CC] text-[#8A6810]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function formatScore(score) {
  return typeof score === "number" ? `${score}/5` : "--";
}

function EvaluationsDepartementRH() {
  const [data, setData] = useState(null);
  const [activeDepartment, setActiveDepartment] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setErrorMessage("");
    const response = await getRhDepartmentEvaluations();
    setData(response);
    setActiveDepartment((current) => current || response.departments?.[0]?.department || "");
    setSelectedMember(null);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const response = await getRhDepartmentEvaluations();
        if (cancelled) return;
        setData(response);
        setActiveDepartment(response.departments?.[0]?.department || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des evaluations par departement impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const departmentGroups = data?.departments || [];
  const selectedDepartment = useMemo(
    () => departmentGroups.find((group) => group.department === activeDepartment) || departmentGroups[0],
    [departmentGroups, activeDepartment]
  );
  const scoreGap =
    selectedMember && typeof selectedMember.gap === "number"
      ? selectedMember.gap.toFixed(1)
      : "0.0";

  async function handleSelectForValidation() {
    if (!selectedMember?.id) return;

    try {
      setIsSelecting(true);
      setFeedbackMessage("");
      const response = await selectRhDepartmentEvaluation(selectedMember.id);
      setFeedbackMessage(response.message || "Evaluation ajoutee a la validation RH.");
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || "Selection RH impossible.");
    } finally {
      setIsSelecting(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Chargement des evaluations par departement...</section>;
  }

  if (errorMessage) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</section>;
  }

  if (!selectedDepartment) {
    return <section className="rounded-md bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Aucune evaluation transmise a la RH pour le moment.</section>;
  }

  return (
    <section className="space-y-5">
      {feedbackMessage ? (
        <div className="rounded-md bg-[#DCECCB] px-4 py-3 text-sm font-semibold text-[#184D2E]">{feedbackMessage}</div>
      ) : null}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#0F3A63]">Evaluations des equipes par departement</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Vue RH de toutes les evaluations : auto-evaluation, evaluation manager et score final.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {departmentGroups.map((group) => (
              <button
                key={group.department}
                type="button"
                onClick={() => {
                  setActiveDepartment(group.department);
                  setSelectedMember(null);
                }}
                className={`rounded-full px-4 py-2 text-xs font-bold ${
                  activeDepartment === group.department ? "bg-[#0D496A] text-white" : "bg-[#E7EDF3] text-[#0F3A63]"
                }`}
              >
                {group.department}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-[#0D496A] p-4 text-white">
          <p className="text-sm font-semibold">Departement</p>
          <p className="mt-2 text-2xl font-black leading-none">{selectedDepartment.department}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Evaluations visibles</p>
          <p className="mt-2 text-2xl font-black leading-none text-[#0F3A63]">{selectedDepartment.members.length}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Moyenne du departement</p>
          <p className="mt-2 text-2xl font-black leading-none text-[#78B843]">
            {typeof selectedDepartment.average === "number" ? `${selectedDepartment.average}/5` : "--"}
          </p>
        </article>
      </div>

      <article className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[#0F3A63]">Equipe {selectedDepartment.department}</h3>
            <p className="text-sm font-semibold text-slate-500">
              Responsable d'equipe : {selectedDepartment.manager || "Manager"} - Manager du departement : {selectedDepartment.manager || "Manager"}
            </p>
          </div>
          <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-bold text-[#0F4A72]">
            {selectedDepartment.members.length} evaluation(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-[#F3F6F8] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Evaluateur</th>
                <th className="px-4 py-3">Auto-eval</th>
                <th className="px-4 py-3">Eval manager</th>
                <th className="px-4 py-3">Score final</th>
                <th className="px-4 py-3">Statut RH</th>
              </tr>
            </thead>
            <tbody>
              {selectedDepartment.members.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={`cursor-pointer border-b border-slate-100 text-[#0F3A63] last:border-0 hover:bg-[#F8FAFC] ${
                    selectedMember?.id === member.id ? "bg-[#EEF6E8]" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <p className="font-bold">{member.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{member.role}</p>
                  </td>
                  <td className="px-4 py-4 font-semibold">{member.evaluator}</td>
                  <td className="px-4 py-4 font-bold">{formatScore(member.selfScore)}</td>
                  <td className="px-4 py-4 font-bold">{formatScore(member.managerScore)}</td>
                  <td className="px-4 py-4 text-lg font-black text-[#78B843]">{formatScore(member.finalScore)}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(member.status)}`}>
                      {member.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {selectedMember ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E2B4F]/45 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evaluation-detail-title"
          onClick={() => setSelectedMember(null)}
        >
          <article
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Detail de l'evaluation</p>
                <h3 id="evaluation-detail-title" className="mt-1 text-2xl font-black text-[#0F3A63]">
                  {selectedMember.name}
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  {selectedMember.role} - {selectedDepartment.department}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={selectedMember.rhValidationSelected || selectedMember.status === "Validé" || selectedMember.status === "Pret Associe" || !selectedMember.id || selectedMember.id.startsWith("pending-") || isSelecting}
                  onClick={handleSelectForValidation}
                  className="rounded-full bg-[#E7EDF3] px-4 py-2 text-xs font-bold text-[#0F4A72] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectedMember.rhValidationSelected ? "A valider RH" : "Valider"}
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-[#0F3A63] hover:bg-slate-200"
                  aria-label="Fermer le detail de l'evaluation"
                >
                  x
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Auto-evaluation</p>
                <p className="mt-2 text-2xl font-black text-[#0F3A63]">{formatScore(selectedMember.selfScore)}</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Evaluation manager</p>
                <p className="mt-2 text-2xl font-black text-[#0F3A63]">{formatScore(selectedMember.managerScore)}</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Score final</p>
                <p className="mt-2 text-2xl font-black text-[#78B843]">{formatScore(selectedMember.finalScore)}</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Ecart constate</p>
                <p className="mt-2 text-2xl font-black text-[#C53B3B]">{scoreGap}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <section className="rounded-lg bg-[#F8FAFC] p-4">
                <h4 className="text-sm font-extrabold text-[#0F3A63]">Commentaires d'evaluation</h4>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{selectedMember.commentSummary}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  Point RH : {Number(scoreGap) >= 0.7 ? "ecart significatif a arbitrer avec le manager." : "evaluation coherente, prete pour validation RH."}
                </p>
              </section>

              <section className="rounded-lg bg-[#F8FAFC] p-4">
                <h4 className="text-sm font-extrabold text-[#0F3A63]">Criteres principaux</h4>
                <div className="mt-3 space-y-3">
                  {selectedMember.sectionSummaries.length ? (
                    selectedMember.sectionSummaries.map((criterion) => (
                      <div key={criterion.label}>
                        <div className="mb-1 flex items-center justify-between text-xs font-bold text-[#0F4A72]">
                          <span>{criterion.label}</span>
                          <span>{formatScore(criterion.score)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className="h-2 rounded-full bg-[#4E75C7]" style={{ width: `${Number(criterion.score) * 20}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Aucun critere principal disponible.</p>
                  )}
                </div>
              </section>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

export default EvaluationsDepartementRH;
