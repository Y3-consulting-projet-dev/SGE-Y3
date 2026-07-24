import HistoriqueEvaluation from "@/components/historique/HistoriqueEvaluation";
import { getMyAssistantEvaluationHistory } from "@/api/collaboratorEvaluation";

function Monhistorique() {
  return <HistoriqueEvaluation fetchHistory={getMyAssistantEvaluationHistory} />;
}

export default Monhistorique;
