import { getSupportSelfEvaluation } from "@/api/supportEvaluation";
import { useAsync } from "./useAsync";

export function useSupportEvaluation() {
  const { data, isLoading, error } = useAsync(getSupportSelfEvaluation, []);

  return {
    evaluation: data?.evaluation || null,
    summary: data?.summary || {},
    sections: data?.evaluation?.sections || [],
    support: data?.support || null,
    chiefComments: data?.chief_comments || [],
    isLoading,
    error,
  };
}
