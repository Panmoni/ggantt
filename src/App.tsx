import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import logoUrl from "@/assets/logo.svg";
import { CalendarView } from "@/components/CalendarView";
import { FilterBar } from "@/components/FilterBar";
import { GanttChart } from "@/components/GanttChart";
import { IssuesTable } from "@/components/IssuesTable";
import { LoginScreen } from "@/components/LoginScreen";
import { ProjectGantt } from "@/components/ProjectGantt";
import { GanttSkeleton } from "@/components/Skeleton";
import { WorkloadView } from "@/components/WorkloadView";
import { useIssues } from "@/hooks/useIssues";
import { useProjects } from "@/hooks/useProjects";
import { useViewer } from "@/hooks/useViewer";
import {
  applyFilters,
  buildOptions,
  type Filters,
  type GroupBy,
} from "@/lib/filters";
import { UnauthenticatedError } from "@/lib/linear";
import { type FontScale, loadFontScale, saveFontScale } from "@/lib/prefs";
import type { IssueNode, ProjectNode } from "@/lib/queries";
import { parseUrl, toQuery } from "@/lib/urlState";

type View = "gantt" | "table" | "calendar" | "workload" | "projects";

const VIEWS: View[] = ["gantt", "table", "calendar", "workload", "projects"];

const VIEW_LABEL: Record<View, string> = {
  gantt: "Gantt",
  table: "Table",
  calendar: "Calendar",
  workload: "Workload",
  projects: "Projects",
};

export function App() {
  const {
    data: viewer,
    isLoading: viewerLoading,
    error: viewerError,
  } = useViewer();

  if (viewerLoading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (viewerError instanceof UnauthenticatedError || !viewer) {
    return <LoginScreen />;
  }

  if (viewerError) {
    return (
      <ErrorPanel
        message={
          viewerError instanceof Error
            ? viewerError.message
            : String(viewerError)
        }
        title="Failed to talk to Linear"
      />
    );
  }

  return <SignedIn viewerName={viewer.name} />;
}

function SignedIn({ viewerName }: { viewerName: string }) {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const { data: issues, isLoading, error } = useIssues();
  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjects();
  const initial = useMemo(
    () => parseUrl(window.location.search, "gantt", VIEWS),
    []
  );
  const [view, setView] = useState<View>(initial.view as View);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [groupBy, setGroupBy] = useState<GroupBy>(initial.groupBy);
  const [fontScale, setFontScaleState] = useState<FontScale>(loadFontScale);

  const setFontScale = (s: FontScale) => {
    setFontScaleState(s);
    saveFontScale(s);
  };

  useEffect(() => {
    const qs = toQuery({ view, groupBy, filters });
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [view, groupBy, filters]);

  const options = useMemo(() => buildOptions(issues ?? []), [issues]);
  const filtered = useMemo(
    () => applyFilters(issues ?? [], filters),
    [issues, filters]
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["issues"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  return (
    <main className="w-full p-6">
      <AppHeader
        fetching={fetching}
        onRefresh={refresh}
        setView={setView}
        view={view}
        viewerName={viewerName}
      />
      {view === "projects" ? (
        <ProjectsView
          error={projectsError}
          isLoading={projectsLoading}
          projects={projects}
        />
      ) : (
        <IssueArea
          error={error}
          filtered={filtered}
          filters={filters}
          fontScale={fontScale}
          groupBy={groupBy}
          isLoading={isLoading}
          issues={issues}
          options={options}
          setFilters={setFilters}
          setFontScale={setFontScale}
          setGroupBy={setGroupBy}
          view={view}
        />
      )}
    </main>
  );
}

function AppHeader({
  view,
  setView,
  fetching,
  onRefresh,
  viewerName,
}: {
  view: View;
  setView: (v: View) => void;
  fetching: number;
  onRefresh: () => void;
  viewerName: string;
}) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img alt="" height={28} src={logoUrl} width={28} />
          <h1 className="font-semibold text-2xl text-slate-900">ggantt</h1>
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          {VIEWS.map((v) => (
            <button
              className={`px-3 py-1 text-sm transition ${
                view === v
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
              key={v}
              onClick={() => setView(v)}
              type="button"
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <button
          className="rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 text-sm hover:bg-slate-100 disabled:opacity-50"
          disabled={fetching > 0}
          onClick={onRefresh}
          type="button"
        >
          {fetching > 0 ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>
      <div className="text-right">
        <p className="text-slate-500 text-sm">
          Signed in as <span className="font-medium">{viewerName}</span>
        </p>
        <p className="font-mono text-[10px] text-slate-300 leading-none">
          {__COMMIT_HASH__}
        </p>
      </div>
    </header>
  );
}

function ChartBody({
  view,
  filtered,
  groupBy,
  fontScale,
}: {
  view: View;
  filtered: IssueNode[];
  groupBy: GroupBy;
  fontScale: FontScale;
}) {
  switch (view) {
    case "gantt":
      return (
        <GanttChart fontScale={fontScale} groupBy={groupBy} issues={filtered} />
      );
    case "calendar":
      return <CalendarView issues={filtered} />;
    case "workload":
      return <WorkloadView issues={filtered} />;
    default:
      return <IssuesTable issues={filtered} />;
  }
}

function IssueArea({
  issues,
  isLoading,
  error,
  options,
  filters,
  setFilters,
  groupBy,
  setGroupBy,
  fontScale,
  setFontScale,
  filtered,
  view,
}: {
  issues: IssueNode[] | undefined;
  isLoading: boolean;
  error: unknown;
  options: ReturnType<typeof buildOptions>;
  filters: Filters;
  setFilters: (f: Filters) => void;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
  fontScale: FontScale;
  setFontScale: (s: FontScale) => void;
  filtered: IssueNode[];
  view: View;
}) {
  if (isLoading) {
    return <GanttSkeleton />;
  }
  if (error) {
    return (
      <ErrorPanel
        message={error instanceof Error ? error.message : String(error)}
        title="Failed to load issues"
      />
    );
  }
  if (!issues || issues.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
        No issues found.
      </div>
    );
  }
  return (
    <>
      <FilterBar
        filters={filters}
        fontScale={fontScale}
        groupBy={groupBy}
        options={options}
        setFilters={setFilters}
        setFontScale={setFontScale}
        setGroupBy={setGroupBy}
      />
      <p className="mb-3 text-slate-500 text-sm">
        {filtered.length} of {issues.length} issue
        {issues.length === 1 ? "" : "s"}
      </p>
      {filtered.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
          No issues match the current filters.
        </div>
      ) : (
        <ChartBody
          filtered={filtered}
          fontScale={fontScale}
          groupBy={groupBy}
          view={view}
        />
      )}
    </>
  );
}

function ProjectsView({
  projects,
  isLoading,
  error,
}: {
  projects: ProjectNode[] | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return <GanttSkeleton />;
  }
  if (error) {
    return (
      <ErrorPanel
        message={error instanceof Error ? error.message : String(error)}
        title="Failed to load projects"
      />
    );
  }
  if (!projects || projects.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
        No projects found.
      </div>
    );
  }
  return (
    <>
      <p className="mb-3 text-slate-500 text-sm">
        {projects.length} project{projects.length === 1 ? "" : "s"}
      </p>
      <ProjectGantt projects={projects} />
    </>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-6">
      <h2 className="font-semibold text-lg text-red-800">{title}</h2>
      <pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap text-red-700 text-sm">
        {message}
      </pre>
    </div>
  );
}
