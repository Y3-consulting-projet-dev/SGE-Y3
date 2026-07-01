import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMySeniorEvaluationHistory } from "@/lib/seniorEvaluation";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMySeniorEvaluationHistory} />;
}

export default Monhistorique;
