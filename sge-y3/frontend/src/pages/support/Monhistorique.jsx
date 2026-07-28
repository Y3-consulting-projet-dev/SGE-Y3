import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMySupportEvaluationHistory } from "@/api/supportEvaluation";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMySupportEvaluationHistory} />;
}

export default Monhistorique;
