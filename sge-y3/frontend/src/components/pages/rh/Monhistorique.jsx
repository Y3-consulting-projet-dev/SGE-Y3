import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMyRhEvaluationHistory } from "@/api/rhOverview";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMyRhEvaluationHistory} />;
}

export default Monhistorique;
