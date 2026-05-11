import { useMemo, useState } from "react";
import { departmentEvaluationGroups } from "@/components/pages/rh/rhData";

function statusClass(status) {
  if (status === "Validé RH" || status === "Prêt Associé") return "bg-[#DDECCF] text-[#4E8B1B]";
  if (status === "Écart à arbitrer" || status === "Sous revue RH") return "bg-[#F9DFDF] text-[#B63232]";
  if (status === "À compléter") return "bg-[#FFF2CC] text-[#8A6810]";
  return "bg-[#E7EDF3] text-[#0F4A72]";
}

function EvaluationsDepartementRH() {
  const [activeDepartment, setActiveDepartment] = useState(departmentEvaluationGroups[0].department);
  const [selectedMember, setSelectedMember] = useState(null);

  const selectedDepartment = useMemo(
    () => departmentEvaluationGroups.find((group) => group.department === activeDepartment) || departmentEvaluationGroups[0],
    [activeDepartment]
  );

  const departmentTeam = selectedDepartment.teams[0];
  const scoreGap = selectedMember ? Math.abs(Number(selectedMember.selfScore) - Number(selectedMember.managerScore)).toFixed(1) : "0.0";

  const handleDepartmentChange = (department) => {
    setActiveDepartment(department);
    setSelectedMember(null);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#0F3A63]">Évaluations des équipes par département</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Vue RH de toutes les évaluations : auto-évaluation, évaluation manager et score final.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {departmentEvaluationGroups.map((group) => (
              <button
                key={group.department}
                onClick={() => handleDepartmentChange(group.department)}
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
          <p className="text-sm font-semibold">Département</p>
          <p className="mt-2 text-2xl font-black leading-none">{selectedDepartment.department}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Évaluations visibles</p>
          <p className="mt-2 text-2xl font-black leading-none text-[#0F3A63]">{departmentTeam.members.length}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Moyenne du département</p>
          <p className="mt-2 text-2xl font-black leading-none text-[#78B843]">{selectedDepartment.average}/5</p>
        </article>
      </div>

      <article className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-[#0F3A63]">Équipe {selectedDepartment.department}</h3>
              <p className="text-sm font-semibold text-slate-500">
                Responsable d'équipe : {departmentTeam.lead} - Manager du département : {selectedDepartment.manager}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#E7EDF3] px-3 py-1 text-xs font-bold text-[#0F4A72]">
                {departmentTeam.members.length} évaluation(s)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-[#F3F6F8] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Collaborateur</th>
                  <th className="px-4 py-3">Évaluateur</th>
                  <th className="px-4 py-3">Auto-éval</th>
                  <th className="px-4 py-3">Éval manager</th>
                  <th className="px-4 py-3">Score final</th>
                  <th className="px-4 py-3">Statut RH</th>
                </tr>
              </thead>
              <tbody>
                {departmentTeam.members.map((member) => (
                  <tr
                    key={member.name}
                    onClick={() => setSelectedMember(member)}
                    className={`cursor-pointer border-b border-slate-100 text-[#0F3A63] last:border-0 hover:bg-[#F8FAFC] ${
                      selectedMember?.name === member.name ? "bg-[#EEF6E8]" : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <p className="font-bold">{member.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{member.role}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold">{member.evaluator}</td>
                    <td className="px-4 py-4 font-bold">{member.selfScore}/5</td>
                    <td className="px-4 py-4 font-bold">{member.managerScore}/5</td>
                    <td className="px-4 py-4 text-lg font-black text-[#78B843]">{member.finalScore}/5</td>
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
                <p className="text-xs font-bold uppercase text-slate-400">Détail de l'évaluation</p>
                <h3 id="evaluation-detail-title" className="mt-1 text-2xl font-black text-[#0F3A63]">
                  {selectedMember.name}
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  {selectedMember.role} - {selectedDepartment.department}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(selectedMember.status)}`}>
                  {selectedMember.status}
                </span>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-[#0F3A63] hover:bg-slate-200"
                  aria-label="Fermer le détail de l'évaluation"
                >
                  x
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Auto-évaluation</p>
                <p className="mt-2 text-2xl font-black text-[#0F3A63]">{selectedMember.selfScore}/5</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Évaluation manager</p>
                <p className="mt-2 text-2xl font-black text-[#0F3A63]">{selectedMember.managerScore}/5</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Score final</p>
                <p className="mt-2 text-2xl font-black text-[#78B843]">{selectedMember.finalScore}/5</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Écart constaté</p>
                <p className="mt-2 text-2xl font-black text-[#C53B3B]">{scoreGap}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <section className="rounded-lg bg-[#F8FAFC] p-4">
                <h4 className="text-sm font-extrabold text-[#0F3A63]">Commentaires d'évaluation</h4>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  Évaluateur : {selectedMember.evaluator}. Les scores sont consultables par la RH pour vérifier la cohérence entre
                  l'auto-évaluation et l'appréciation managériale avant validation.
                </p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  Point RH : {Number(scoreGap) >= 0.7 ? "écart significatif à arbitrer avec le manager." : "évaluation cohérente, prête pour validation RH."}
                </p>
              </section>

              <section className="rounded-lg bg-[#F8FAFC] p-4">
                <h4 className="text-sm font-extrabold text-[#0F3A63]">Critères principaux</h4>
                <div className="mt-3 space-y-3">
                  {[
                    { label: "Leadership & comportement", score: selectedMember.finalScore },
                    { label: "Compétences techniques", score: selectedMember.managerScore },
                    { label: "Respect des objectifs", score: selectedMember.selfScore },
                  ].map((criterion) => (
                    <div key={criterion.label}>
                      <div className="mb-1 flex items-center justify-between text-xs font-bold text-[#0F4A72]">
                        <span>{criterion.label}</span>
                        <span>{criterion.score}/5</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-[#4E75C7]" style={{ width: `${Number(criterion.score) * 20}%` }} />
                      </div>
                    </div>
                  ))}
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
