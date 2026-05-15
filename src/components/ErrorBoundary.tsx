import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Query/network errors are already handled by ErrorPanel in App. This catches
// the other failure mode: an unexpected render throw (e.g. a Linear payload
// that slips past the TS types) which would otherwise blank the whole page
// with no way back. React has no hook equivalent — a class is required.
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-lg rounded border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-lg text-red-800">
            Something went wrong
          </h2>
          <p className="mt-1 text-red-700 text-sm">
            The view crashed unexpectedly. Reloading usually clears it.
          </p>
          <pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap text-red-700 text-xs">
            {error.message}
          </pre>
          <button
            className="mt-4 rounded bg-red-700 px-3 py-1.5 font-medium text-sm text-white hover:bg-red-800"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
