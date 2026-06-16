import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMyRhEvaluationHistory } from "@/lib/rhOverview";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMyRhEvaluationHistory} />;
}

export default Monhistorique;
