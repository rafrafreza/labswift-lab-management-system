import { useEffect } from "react";

/**
 * Asks the browser to confirm before the tab is refreshed or closed while a form has unsaved input.
 * (Moving between pages inside the app is not intercepted.)
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // required by some browsers to show the prompt
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
