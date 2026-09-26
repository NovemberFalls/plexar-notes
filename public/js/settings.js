// The settings dialog: <dialog id="settings"> in index.html, with a segmented control per
// choice and a switch for file extensions. Values live in state.js (settings); this module
// draws them, applies each change the moment it is made, and reports it to the caller.
// The visual settings land as custom properties on :root so the CSS does the rest.
import { SETTING_OPTIONS, setting, setSetting } from "./state.js";

const TEXT_SCALE = { small: "0.9", default: "1", large: "1.12" };
const LINE_WIDTH = { default: "750px", wide: "900px" };
const EDITOR_FONT = { mono: "var(--px-font-mono)", ui: "var(--px-font-ui)" };

// Put the visual settings on :root. Safe to call before the dialog exists.
export function applySettingsToRoot(root = document.documentElement) {
  const style = root.style;
  style.setProperty("--text-scale", TEXT_SCALE[setting("textSize")] || TEXT_SCALE.default);
  style.setProperty("--line-width", LINE_WIDTH[setting("lineWidth")] || LINE_WIDTH.default);
  style.setProperty("--editor-font", EDITOR_FONT[setting("font")] || EDITOR_FONT.mono);
}

// The option value a button's data-value stands for (numbers stay numbers).
function valueOf(key, raw) {
  return SETTING_OPTIONS[key].find((v) => String(v) === raw);
}

// dialog: the <dialog id="settings">. onChange(key, value) fires after a setting was changed
// and the root was updated, for anything the CSS cannot do (autosave delay, the tree).
export function createSettings(dialog, { onChange } = {}) {
  const groups = Array.from(dialog.querySelectorAll(".seg[data-setting]"));
  const extensions = dialog.querySelector("#setting-extensions");
  const folder = dialog.querySelector("#settings-folder");
  let opener = null; // where focus goes back to on close

  function draw() {
    for (const group of groups) {
      const key = group.dataset.setting;
      const current = String(setting(key));
      for (const btn of group.querySelectorAll("[data-value]")) {
        const on = btn.dataset.value === current;
        btn.setAttribute("aria-checked", on ? "true" : "false");
        btn.classList.toggle("selected", on);
        btn.tabIndex = on ? 0 : -1;
      }
    }
    if (extensions) {
      extensions.checked = setting("showExtensions") === true;
      extensions.setAttribute("aria-checked", extensions.checked ? "true" : "false");
    }
  }

  function change(key, value) {
    if (value === undefined || setting(key) === value) return;
    setSetting(key, value);
    applySettingsToRoot();
    draw();
    if (typeof onChange === "function") onChange(key, value);
  }

  for (const group of groups) {
    const key = group.dataset.setting;
    group.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-value]");
      if (!btn || !group.contains(btn)) return;
      change(key, valueOf(key, btn.dataset.value));
      btn.focus();
    });
    // Arrow keys move the choice, as in a radio group.
    group.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(group.querySelectorAll("[data-value]"));
      const at = buttons.findIndex((b) => b.getAttribute("aria-checked") === "true");
      const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const next = buttons[(Math.max(0, at) + step + buttons.length) % buttons.length];
      change(key, valueOf(key, next.dataset.value));
      next.focus();
    });
  }

  if (extensions) {
    extensions.addEventListener("change", () => change("showExtensions", extensions.checked));
  }

  function open(from) {
    opener = from || document.activeElement;
    draw();
    if (dialog.open) return;
    dialog.showModal();
    const first = dialog.querySelector('[role="radio"][aria-checked="true"]') || dialog.querySelector("#settings-close");
    if (first) first.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  // Escape fires 'cancel', then 'close'; the Close buttons call close(). Either way focus
  // returns to the button that opened the dialog.
  dialog.addEventListener("close", () => {
    if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    opener = null;
  });
  // A click on the backdrop (outside the dialog box) closes it too.
  dialog.addEventListener("mousedown", (event) => {
    if (event.target === dialog) close();
  });
  for (const id of ["#settings-close", "#settings-dismiss"]) {
    const btn = dialog.querySelector(id);
    if (btn) btn.addEventListener("click", close);
  }

  applySettingsToRoot();
  draw();

  return {
    open,
    close,
    toggle(from) {
      if (dialog.open) close();
      else open(from);
    },
    isOpen: () => dialog.open,
    // The 'About' line names the folder that is open.
    setFolder(text) {
      if (folder) folder.textContent = text || "";
    },
  };
}
