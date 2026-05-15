export function GanttSkeleton() {
  return (
    <div className="overflow-hidden rounded border border-slate-200">
      <div className="flex items-center gap-3 border-slate-200 border-b bg-slate-50 px-3 py-3">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="ml-auto h-3 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          className="flex items-center gap-4 border-slate-100 border-b px-3"
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          key={i}
          style={{ height: 30 }}
        >
          <div className="h-3 w-44 shrink-0 animate-pulse rounded bg-slate-200" />
          <div
            className="h-4 animate-pulse rounded bg-slate-200"
            style={{
              width: `${20 + ((i * 37) % 55)}%`,
              marginLeft: `${(i * 23) % 30}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
