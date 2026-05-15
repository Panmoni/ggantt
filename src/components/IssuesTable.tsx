import { format, parseISO } from "date-fns";
import type { IssueNode } from "@/lib/queries";
import { safeHref } from "@/lib/safeHref";

function fmtDate(s: string | null): string {
  if (!s) {
    return "—";
  }
  try {
    return format(parseISO(s), "yyyy-MM-dd");
  } catch {
    return s;
  }
}

const STATE_COLOR: Record<string, string> = {
  backlog: "bg-slate-200 text-slate-700",
  unstarted: "bg-slate-100 text-slate-700",
  started: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  canceled: "bg-zinc-100 text-zinc-500 line-through",
  triage: "bg-amber-100 text-amber-800",
};

export function IssuesTable({ issues }: { issues: IssueNode[] }) {
  return (
    <div className="overflow-auto rounded border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">State</th>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Est</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Team</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {issues.map((i) => {
            const stateClass =
              STATE_COLOR[i.state.type] ?? "bg-slate-100 text-slate-700";
            return (
              <tr className="hover:bg-slate-50" key={i.id}>
                <td className="px-3 py-2 font-mono text-slate-500 text-xs">
                  <a
                    className="hover:underline"
                    href={safeHref(i.url)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {i.identifier}
                  </a>
                </td>
                <td className="px-3 py-2 text-slate-900">{i.title}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${stateClass}`}
                  >
                    {i.state.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtDate(i.startedAt ?? i.createdAt)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtDate(i.dueDate)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {i.estimate ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {i.assignee?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {i.project?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">{i.team.key}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
