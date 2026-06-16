import { useState } from "react";
import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import MemberPicker from "@/components/historique/MemberPicker";
import { getManagerMemberHistory } from "@/lib/managerOverview";

function HistoriqueEquipe({ members = [], isLoading, errorMessage }) {
  const [selectedId, setSelectedId] = useState(members[0]?.id || "");

  if (isLoading) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">Chargement de l'équipe...</div>;
  }

  if (errorMessage) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</div>;
  }

  const pickerMembers = members.map((member) => ({
    id: member.id,
    name: member.name,
    grade: member.grade,
    department: member.department,
  }));

  const currentId = selectedId || pickerMembers[0]?.id || "";

  return (
    <div className="space-y-4">
      <MemberPicker members={pickerMembers} selectedId={currentId} onSelect={setSelectedId} />
      {currentId ? (
        <HistoriqueEvaluation key={currentId} fetchHistory={() => getManagerMemberHistory(currentId)} />
      ) : null}
    </div>
  );
}

export default HistoriqueEquipe;
