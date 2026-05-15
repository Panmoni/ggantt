export function LoginScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <div>
        <h1 className="font-semibold text-3xl text-slate-900">ggantt</h1>
        <p className="mt-2 text-slate-600">
          A Gantt view of your Linear issues.
        </p>
      </div>
      <a
        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 font-medium text-sm text-white shadow-sm transition hover:bg-slate-800"
        href="/oauth/start"
      >
        Log in with Linear
      </a>
    </div>
  );
}
