import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getManagerSelfEvaluationHistory } from "@/lib/managerOverview";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getManagerSelfEvaluationHistory} />;
}

export default Monhistorique;
