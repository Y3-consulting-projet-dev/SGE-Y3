import { useState } from "react";
import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import MemberPicker from "@/components/historique/MemberPicker";
import { getSeniorAssistantHistory } from "@/lib/seniorAssistants";

function HistoriqueAssistants({ assistants = [], isLoading, errorMessage }) {
  const [selectedId, setSelectedId] = useState(assistants[0]?.id || "");

  if (isLoading) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">Chargement des assistants...</div>;
  }

  if (errorMessage) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</div>;
  }

  const members = assistants.map((assistant) => ({
    id: assistant.id,
    name: assistant.name,
    grade: assistant.grade,
    department: assistant.department,
  }));

  const currentId = selectedId || members[0]?.id || "";

  return (
    <div className="space-y-4">
      <MemberPicker members={members} selectedId={currentId} onSelect={setSelectedId} />
      {currentId ? (
        <HistoriqueEvaluation key={currentId} fetchHistory={() => getSeniorAssistantHistory(currentId)} />
      ) : null}
    </div>
  );
}

export default HistoriqueAssistants;
