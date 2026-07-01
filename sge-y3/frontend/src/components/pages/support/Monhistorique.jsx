import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMySupportEvaluationHistory } from "@/lib/supportEvaluation";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMySupportEvaluationHistory} />;
}

export default Monhistorique;
