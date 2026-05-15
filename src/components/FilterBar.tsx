import { MultiSelect } from "@/components/MultiSelect";
import {
  emptyFilters,
  type FilterOptions,
  type Filters,
  GROUP_BY_VALUES,
  type GroupBy,
} from "@/lib/filters";
import { FONT_SCALE_LABEL, FONT_SCALES, type FontScale } from "@/lib/prefs";

interface Props {
  filters: Filters;
  fontScale: FontScale;
  groupBy: GroupBy;
  options: FilterOptions;
  setFilters: (f: Filters) => void;
  setFontScale: (s: FontScale) => void;
  setGroupBy: (g: GroupBy) => void;
}

export function FilterBar({
  options,
  filters,
  setFilters,
  groupBy,
  setGroupBy,
  fontScale,
  setFontScale,
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
          {GROUP_BY_VALUES.map((g) => (
            <option className="capitalize" key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 text-sm">Text:</span>
        <div className="flex overflow-hidden rounded border border-slate-200">
          {FONT_SCALES.map((s) => (
            <button
              className={`px-2 py-1.5 text-sm transition ${
                fontScale === s
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
              key={s}
              onClick={() => setFontScale(s)}
              title={`${FONT_SCALE_LABEL[s]} text size`}
              type="button"
            >
              {FONT_SCALE_LABEL[s]}
            </button>
          ))}
        </div>
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
