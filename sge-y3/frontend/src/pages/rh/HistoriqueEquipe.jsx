import { useEffect, useState } from "react";
import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import MemberSearchSelect from "@/components/historique/MemberSearchSelect";
import { getRhTeamMembers, getRhTeamMemberHistory } from "@/api/rhOverview";

function HistoriqueEquipe() {
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await getRhTeamMembers();

        if (cancelled) return;

        const list = response.members || [];
        setMembers(list);
        setSelectedId((current) => current || list[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Chargement des collaborateurs impossible.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">Chargement des collaborateurs...</div>;
  }

  if (errorMessage) {
    return <div className="rounded-md bg-white p-4 text-sm font-semibold text-red-600 shadow-sm">{errorMessage}</div>;
  }

  const currentId = selectedId || members[0]?.id || "";

  return (
    <div className="space-y-4">
      <MemberSearchSelect members={members} selectedId={currentId} onSelect={setSelectedId} />
      {currentId ? (
        <HistoriqueEvaluation key={currentId} fetchHistory={() => getRhTeamMemberHistory(currentId)} />
      ) : null}
    </div>
  );
}

export default HistoriqueEquipe;
