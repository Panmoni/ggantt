import { useMutation, useQueryClient } from "@tanstack/react-query";
import { linearRequest } from "@/lib/linear";
import {
  ISSUE_SET_DUE_MUTATION,
  type IssueNode,
  type IssueSetDueResponse,
} from "@/lib/queries";

interface Vars {
  dueDate: string | null;
  id: string;
}

type Snapshot = [readonly unknown[], IssueNode[] | undefined][];

export function useUpdateIssueDueDate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dueDate }: Vars) =>
      linearRequest<IssueSetDueResponse>(ISSUE_SET_DUE_MUTATION, {
        id,
        dueDate,
      }),

    onMutate: async ({ id, dueDate }: Vars) => {
      await qc.cancelQueries({ queryKey: ["issues"] });
      const prev = qc.getQueriesData<IssueNode[]>({
        queryKey: ["issues"],
      }) as Snapshot;
      qc.setQueriesData<IssueNode[]>({ queryKey: ["issues"] }, (old) =>
        old?.map((i) => (i.id === id ? { ...i, dueDate } : i))
      );
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) {
        qc.setQueryData(key, data);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
    },
  });
}
