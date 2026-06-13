import { useQuery } from "@tanstack/react-query";
import { linearRequest } from "@/lib/linear";
import {
  PROJECTS_QUERY,
  type ProjectNode,
  type ProjectsResponse,
} from "@/lib/queries";
import { isDoneCancelledOrDuplicate } from "@/lib/status";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<ProjectNode[]> => {
      // Linear caps GraphQL query complexity at 10,000. Each project pulls a
      // nested projectMilestones connection, so we page in small batches to
      // stay under the limit and walk pageInfo until exhausted.
      const nodes: ProjectNode[] = [];
      let after: string | null = null;
      do {
        const data: ProjectsResponse = await linearRequest<ProjectsResponse>(
          PROJECTS_QUERY,
          {
            first: 50,
            after,
          }
        );
        nodes.push(...data.projects.nodes);
        after = data.projects.pageInfo.hasNextPage
          ? data.projects.pageInfo.endCursor
          : null;
      } while (after !== null);
      // Hide resolved projects (Done / Cancelled / Duplicate) from the
      // Projects view — only active work belongs on the roadmap.
      return nodes.filter((p) => !isDoneCancelledOrDuplicate(p.status));
    },
    staleTime: 5000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });
}
