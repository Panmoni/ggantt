import { useQuery } from "@tanstack/react-query";
import { linearRequest } from "@/lib/linear";
import { VIEWER_QUERY, type ViewerResponse } from "@/lib/queries";

export function useViewer() {
  return useQuery({
    queryKey: ["viewer"],
    queryFn: async () => {
      const data = await linearRequest<ViewerResponse>(VIEWER_QUERY);
      return data.viewer;
    },
  });
}
