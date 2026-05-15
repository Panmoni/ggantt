import { useQuery } from "@tanstack/react-query";
import { linearRequest } from "@/lib/linear";
import {
  PROJECTS_QUERY,
  type ProjectNode,
  type ProjectsResponse,
} from "@/lib/queries";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<ProjectNode[]> => {
      const data = await linearRequest<ProjectsResponse>(PROJECTS_QUERY, {
        first: 250,
      });
      return data.projects.nodes;
    },
    staleTime: 5000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });
}
