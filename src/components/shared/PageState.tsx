import type { ElementType, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/** Friendly "nothing here yet" panel, optionally with a call to action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-14 text-center text-slate-400", className)}>
      <Icon className="mb-3 h-10 w-10 opacity-25" />
      <p className="mb-1 text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="max-w-sm text-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** "Something went wrong" panel with Try again / Go back, so a failed load never leaves a blank screen. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  backTo,
  backLabel = "Go back",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="card mx-auto my-10 flex max-w-md flex-col items-center px-6 py-10 text-center" role="alert">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
      </div>
      <h2 className="mb-1 text-base font-semibold text-slate-800">{title}</h2>
      {message && <p className="mb-5 text-sm text-slate-500">{message}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn btn-primary btn-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        )}
        {backTo && (
          <Link to={backTo} className="btn btn-secondary btn-sm">
            {backLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

/** True when a single-row lookup (.single()) found nothing, as opposed to a network or permission failure. */
export function isNotFoundError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  return /PGRST116|no rows|0 rows|multiple \(or no\) rows|Report not found/i.test(text);
}

export function getLoadErrorMessage(error: unknown, fallback = "Please check your connection and try again.") {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try again.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
