import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMyAssociateEvaluationHistory } from "@/api/associateOverview";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMyAssociateEvaluationHistory} />;
}

export default Monhistorique;
