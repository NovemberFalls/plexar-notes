// Edit mode for Plexar Notes: a bare textarea that sits in the note column where the
// rendered body normally is. It grows with its content so the note area itself scrolls,
// Tab inserts two spaces, and every keystroke is reported to the caller, who owns the
// autosave and the word count. Mode switching and state live in app.js.
import { icons } from "./icons.js";

export const MODES = ["read", "edit"];

// Put two spaces (or any text) at the caret, keeping the browser's undo stack when it can.
export function insertText(textarea, text) {
  textarea.focus();
  if (typeof document !== "undefined" && document.execCommand) {
    try {
      if (document.execCommand("insertText", false, text)) return;
    } catch {
      // fall through to setRangeText
    }
  }
  const { selectionStart, selectionEnd } = textarea;
  textarea.setRangeText(text, selectionStart, selectionEnd, "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

// The toggle button reflects the current mode: a pencil while editing, a book while reading.
export function applyModeButton(button, mode) {
  const editing = mode === "edit";
  button.innerHTML = editing ? icons.pencil : icons.bookOpen;
  button.dataset.tip = editing ? "Edit" : "Read";
  button.setAttribute("aria-pressed", editing ? "true" : "false");
}

// Wire a textarea as the note editor. onInput(value) fires after each edit.
export function createEditor(textarea, { onInput } = {}) {
  function resize() {
    if (textarea.hidden) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    insertText(textarea, "  ");
  });

  textarea.addEventListener("input", () => {
    resize();
    if (typeof onInput === "function") onInput(textarea.value);
  });

  window.addEventListener("resize", resize);

  return {
    element: textarea,
    load(content) {
      textarea.value = typeof content === "string" ? content : "";
      resize();
    },
    value() {
      return textarea.value;
    },
    show() {
      textarea.hidden = false;
      resize();
    },
    hide() {
      textarea.hidden = true;
    },
    focus() {
      textarea.focus();
    },
    visible() {
      return !textarea.hidden;
    },
    resize,
  };
}
