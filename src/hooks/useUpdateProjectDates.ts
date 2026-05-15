import { useMutation, useQueryClient } from "@tanstack/react-query";
import { linearRequest } from "@/lib/linear";
import {
  PROJECT_SET_DATES_MUTATION,
  type ProjectNode,
  type ProjectSetDatesResponse,
} from "@/lib/queries";

interface Vars {
  id: string;
  startDate: string | null;
  targetDate: string | null;
}

type Snapshot = [readonly unknown[], ProjectNode[] | undefined][];

export function useUpdateProjectDates() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, startDate, targetDate }: Vars) =>
      linearRequest<ProjectSetDatesResponse>(PROJECT_SET_DATES_MUTATION, {
        id,
        startDate,
        targetDate,
      }),

    onMutate: async ({ id, startDate, targetDate }: Vars) => {
      await qc.cancelQueries({ queryKey: ["projects"] });
      const prev = qc.getQueriesData<ProjectNode[]>({
        queryKey: ["projects"],
      }) as Snapshot;
      qc.setQueriesData<ProjectNode[]>({ queryKey: ["projects"] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, startDate, targetDate } : p))
      );
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
