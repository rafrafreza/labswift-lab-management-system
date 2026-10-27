import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Changing this (e.g. the current URL) clears a previous error so navigating away recovers the screen. */
  resetKey?: string;
};

type State = { error: Error | null };

// Page code that fails to download usually means a new version was deployed while this tab was open
function isStaleBundleError(error: Error) {
  const text = `${error.name} ${error.message}`;
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    text,
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isStaleBundleError(error);
    return (
      <div className="card mx-auto my-10 flex max-w-md flex-col items-center px-6 py-10 text-center" role="alert">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
        </div>
        <h2 className="mb-1 text-base font-semibold text-slate-800">
          {stale ? "A new version is available" : "This page hit a problem"}
        </h2>
        <p className="mb-5 text-sm text-slate-500">
          {stale
            ? "Reload to get the latest version of LabSwift."
            : "Your data is safe. Reload the page, or go back to the dashboard and try again."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary btn-sm">
            Reload page
          </button>
          <a href="/dashboard" className="btn btn-secondary btn-sm">
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }
}
