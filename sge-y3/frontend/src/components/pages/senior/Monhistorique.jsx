import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMySeniorEvaluationHistory } from "@/api/seniorEvaluation";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMySeniorEvaluationHistory} />;
}

export default Monhistorique;
