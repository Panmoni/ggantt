import { MultiSelect } from "@/components/MultiSelect";
import {
  emptyFilters,
  type FilterOptions,
  type Filters,
  type GroupBy,
} from "@/lib/filters";

interface Props {
  filters: Filters;
  groupBy: GroupBy;
  options: FilterOptions;
  setFilters: (f: Filters) => void;
  setGroupBy: (g: GroupBy) => void;
}

const GROUPS: GroupBy[] = ["flat", "project", "team", "cycle", "assignee"];

export function FilterBar({
  options,
  filters,
  setFilters,
  groupBy,
  setGroupBy,
}: Props) {
  const patch = (p: Partial<Filters>) => setFilters({ ...filters, ...p });

  const anyActive =
    filters.teams.size > 0 ||
    filters.projects.size > 0 ||
    filters.assignees.size > 0 ||
    filters.states.size > 0 ||
    filters.cycles.size > 0 ||
    filters.hideUnscheduled ||
    !filters.hideCompleted;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <MultiSelect
        label="Team"
        onChange={(teams) => patch({ teams })}
        options={options.teams}
        selected={filters.teams}
      />
      <MultiSelect
        label="Project"
        onChange={(projects) => patch({ projects })}
        options={options.projects}
        selected={filters.projects}
      />
      <MultiSelect
        label="Assignee"
        onChange={(assignees) => patch({ assignees })}
        options={options.assignees}
        selected={filters.assignees}
      />
      <MultiSelect
        label="State"
        onChange={(states) => patch({ states })}
        options={options.states}
        selected={filters.states}
      />
      <MultiSelect
        label="Cycle"
        onChange={(cycles) => patch({ cycles })}
        options={options.cycles}
        selected={filters.cycles}
      />

      <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-700 text-sm">
        <input
          checked={filters.hideUnscheduled}
          className="accent-slate-900"
          onChange={(e) => patch({ hideUnscheduled: e.target.checked })}
          type="checkbox"
        />
        Hide unscheduled
      </label>

      <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-700 text-sm">
        <input
          checked={filters.hideCompleted}
          className="accent-slate-900"
          onChange={(e) => patch({ hideCompleted: e.target.checked })}
          type="checkbox"
        />
        Hide done
      </label>

      <div className="ml-2 flex items-center gap-1.5">
        <span className="text-slate-500 text-sm">Group:</span>
        <select
          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 text-sm capitalize"
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          value={groupBy}
        >
          {GROUPS.map((g) => (
            <option className="capitalize" key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {anyActive && (
        <button
          className="text-blue-600 text-sm hover:underline"
          onClick={() => setFilters(emptyFilters())}
          type="button"
        >
          Reset
        </button>
      )}
    </div>
  );
}
