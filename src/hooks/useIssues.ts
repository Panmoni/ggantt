import { useQuery } from "@tanstack/react-query";
import { linearRequest } from "@/lib/linear";
import {
  ISSUES_QUERY,
  type IssueNode,
  type IssuesResponse,
} from "@/lib/queries";

interface UseIssuesParams {
  first?: number;
  projectId?: string;
  teamId?: string;
}

export function useIssues(params: UseIssuesParams = {}) {
  const first = params.first ?? 250;
  const filter: Record<string, unknown> = {};
  if (params.teamId) {
    filter.team = { id: { eq: params.teamId } };
  }
  if (params.projectId) {
    filter.project = { id: { eq: params.projectId } };
  }

  return useQuery({
    queryKey: ["issues", { first, ...params }],
    queryFn: async (): Promise<IssueNode[]> => {
      const data = await linearRequest<IssuesResponse>(ISSUES_QUERY, {
        first,
        filter: Object.keys(filter).length > 0 ? filter : null,
      });
      // Linear can return the same issue more than once; dedupe by id so
      // every view (Gantt, Table, Calendar, Workload) sees each issue once.
      const seen = new Set<string>();
      return data.issues.nodes.filter((n) => {
        if (seen.has(n.id)) {
          return false;
        }
        seen.add(n.id);
        return true;
      });
    },
    // Pick up changes made directly in Linear without a manual reload.
    staleTime: 5000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });
}
