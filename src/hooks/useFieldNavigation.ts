import { useEffect } from "react";

// Keyboard navigation for data-entry forms, so a lab can fill a report without touching the mouse.
//
//   Enter / Arrow Down  -> next field          Shift+Enter / Arrow Up -> previous field
//
// It works inside any <form> and inside any element marked `data-nav-scope` (the report pages are not <form>s).
// Add `data-nav-ignore` to a field (or its wrapper) that must keep the normal behaviour, e.g. a search box.
//
// Deliberately left alone, because the arrow keys already mean something there:
//   * <select>: arrows change the option (typing its first letter picks it); Enter still moves on
//   * <textarea>: arrows move the caret; Up/Down only leave it from the first/last position; Enter adds a line
//   * date / time inputs and inputs with a suggestion list: arrows keep their native job; Enter still moves on
//   * Enter on the LAST field does what it always did (submits a form)

const FIELD_TYPES = new Set(["text", "number", "tel", "email", "search", "url", "password", "date", "datetime-local", "time", "month"]);
const ARROW_TYPES = new Set(["text", "number", "tel", "email", "search", "url", "password"]);
const FIELD_SELECTOR = "input, select, textarea";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isField(el: Element | null): el is Field {
  if (el instanceof HTMLInputElement) return FIELD_TYPES.has(el.type);
  return el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

function isUsable(el: Field) {
  if (el.disabled || el.tabIndex < 0 || el.closest("[data-nav-ignore]")) return false;
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.readOnly) return false;
  return el.getClientRects().length > 0; // skips hidden / collapsed fields
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
  const { key } = event;
  if (key !== "Enter" && key !== "ArrowDown" && key !== "ArrowUp") return;

  const target = event.target;
  if (!(target instanceof Element) || !isField(target) || !isUsable(target)) return;
  const scope = target.closest("form, [data-nav-scope]");
  if (!scope) return;

  let direction: 1 | -1;
  if (key === "Enter") {
    if (target instanceof HTMLTextAreaElement) return;
    direction = event.shiftKey ? -1 : 1;
  } else {
    if (event.shiftKey || target instanceof HTMLSelectElement) return;
    if (target instanceof HTMLTextAreaElement) {
      const atStart = target.selectionStart === 0 && target.selectionEnd === 0;
      const atEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
      if (key === "ArrowUp" ? !atStart : !atEnd) return;
    } else if (!ARROW_TYPES.has(target.type) || target.hasAttribute("list")) {
      return;
    }
    direction = key === "ArrowDown" ? 1 : -1;
  }

  const fields = Array.from(scope.querySelectorAll<Field>(FIELD_SELECTOR)).filter((el) => isField(el) && isUsable(el));
  const next = fields[fields.indexOf(target) + direction];
  if (!next) return; // no neighbour: leave the key to the browser (Enter on the last field submits the form)

  event.preventDefault();
  next.focus();
  if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
    try {
      next.select(); // typing replaces what was there, the fastest way to overwrite a value
    } catch {
      /* some input types can't be selected */
    }
  }
}

/** Turns on Enter / Up / Down field-to-field navigation for every form on the page. Call once, in the app layout. */
export function useFieldNavigation() {
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
