import { getManagerOverview } from "@/api/managerOverview";
import { useAsync } from "./useAsync";

export function useManagerOverview() {
  const { data, isLoading, error } = useAsync(getManagerOverview, []);

  return {
    overview: data,
    members: data?.members || [],
    summary: data?.summary || {},
    pendingTrainingRequests: data?.pendingTrainingRequests || [],
    isLoading,
    error,
  };
}
