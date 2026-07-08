import { getAssociateOverview } from "@/api/associateOverview";
import { useAsync } from "./useAsync";

export function useAssociateOverview() {
  const { data, isLoading, error } = useAsync(getAssociateOverview, []);

  return {
    overview: data,
    collaborators: data?.collaborators || [],
    supportMembers: data?.support || [],
    managers: data?.managers || [],
    summary: data?.summary || {},
    isLoading,
    error,
  };
}
