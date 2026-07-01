import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMyAssociateEvaluationHistory } from "@/lib/associateOverview";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMyAssociateEvaluationHistory} />;
}

export default Monhistorique;
