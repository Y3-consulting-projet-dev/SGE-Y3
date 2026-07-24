import { getMyAssistantEvaluation } from "@/api/collaboratorEvaluation";
import { useAsync } from "./useAsync";

export function useCollaboratorEvaluation() {
  const { data, isLoading, error } = useAsync(getMyAssistantEvaluation, []);

  return {
    evaluation: data?.evaluation || null,
    summary: data?.summary || {},
    sections: data?.evaluation?.sections || [],
    status: data?.evaluation?.status || "",
    isLoading,
    error,
  };
}
