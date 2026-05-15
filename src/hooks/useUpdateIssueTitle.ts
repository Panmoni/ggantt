import { useMutation, useQueryClient } from "@tanstack/react-query";
import { linearRequest } from "@/lib/linear";
import {
  ISSUE_SET_TITLE_MUTATION,
  type IssueNode,
  type IssueSetTitleResponse,
} from "@/lib/queries";

interface Vars {
  id: string;
  title: string;
}

type Snapshot = [readonly unknown[], IssueNode[] | undefined][];

export function useUpdateIssueTitle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: Vars) =>
      linearRequest<IssueSetTitleResponse>(ISSUE_SET_TITLE_MUTATION, {
        id,
        title,
      }),

    onMutate: async ({ id, title }: Vars) => {
      await qc.cancelQueries({ queryKey: ["issues"] });
      const prev = qc.getQueriesData<IssueNode[]>({
        queryKey: ["issues"],
      }) as Snapshot;
      qc.setQueriesData<IssueNode[]>({ queryKey: ["issues"] }, (old) =>
        old?.map((i) => (i.id === id ? { ...i, title } : i))
      );
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
    },
  });
}
