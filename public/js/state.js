// App state for Plexar Notes: open tabs, the active tab, the sort mode, which folders are
// expanded and how the window is arranged. Everything here survives a reload through
// localStorage; nothing here touches the DOM.

const STORAGE_KEY = "plexar-notes.state";
export const SORT_MODES = ["name-asc", "name-desc", "modified-desc", "modified-asc"];
export const EXPLORER_MIN = 180;
export const EXPLORER_MAX = 480;

export const RIBBON_PANELS = ["files", "search", "starred"];

// The settings dialog's choices, each a closed list; the first entry is the default.
export const SETTING_OPTIONS = {
  font: ["mono", "ui"],
  textSize: ["default", "small", "large"],
  lineWidth: ["default", "wide"],
  autosave: [1000, 500, 2000], // milliseconds
  showExtensions: [false, true],
};

const DEFAULTS = {
  tabs: [], // [{id, path, mode}] where path is null for an empty 'New tab'; mode is 'read' or 'edit'
  activeTab: null, // id of the active tab
  sort: "name-asc",
  expanded: [], // folder paths that are open in the tree
  explorerWidth: 260,
  explorerOpen: true,
  ribbon: "files", // which ribbon panel is showing
  settings: {}, // filled in by sanitise from SETTING_OPTIONS
  starred: {}, // absolute folder root -> [note paths] starred in that folder
};

const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sanitise(saved) {
  const s = { ...DEFAULTS, ...saved };
  s.tabs = Array.isArray(s.tabs)
    ? s.tabs
        .filter((t) => t && typeof t.id === "string")
        .map((t) => ({
          id: t.id,
          path: typeof t.path === "string" ? t.path : null,
          mode: t.mode === "edit" ? "edit" : "read",
        }))
    : [];
  if (!s.tabs.some((t) => t.id === s.activeTab)) s.activeTab = s.tabs.length ? s.tabs[0].id : null;
  if (!SORT_MODES.includes(s.sort)) s.sort = DEFAULTS.sort;
  s.expanded = Array.isArray(s.expanded) ? s.expanded.filter((p) => typeof p === "string") : [];
  const w = Number(s.explorerWidth);
  s.explorerWidth = Number.isFinite(w) ? Math.min(EXPLORER_MAX, Math.max(EXPLORER_MIN, w)) : DEFAULTS.explorerWidth;
  s.explorerOpen = s.explorerOpen !== false;
  if (!RIBBON_PANELS.includes(s.ribbon)) s.ribbon = DEFAULTS.ribbon;
  const settings = s.settings && typeof s.settings === "object" ? s.settings : {};
  s.settings = {};
  for (const [key, options] of Object.entries(SETTING_OPTIONS)) {
    s.settings[key] = options.includes(settings[key]) ? settings[key] : options[0];
  }
  const starred = s.starred && typeof s.starred === "object" && !Array.isArray(s.starred) ? s.starred : {};
  s.starred = {};
  for (const [root, paths] of Object.entries(starred)) {
    if (Array.isArray(paths)) s.starred[root] = [...new Set(paths.filter((p) => typeof p === "string"))];
  }
  return s;
}

export const state = sanitise(read());

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or disabled; the app still works for this session.
  }
}

// Apply a partial update, persist it and tell subscribers which keys changed.
export function update(patch) {
  const changed = [];
  for (const [key, value] of Object.entries(patch)) {
    if (state[key] !== value) {
      state[key] = value;
      changed.push(key);
    }
  }
  if (!changed.length) return;
  save();
  for (const fn of listeners) fn(changed, state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function activeTab() {
  return state.tabs.find((t) => t.id === state.activeTab) || null;
}

export function activePath() {
  const tab = activeTab();
  return tab ? tab.path : null;
}

// The reading/edit mode of a tab; tabs made before modes existed read.
export function tabMode(tab) {
  return tab && tab.mode === "edit" ? "edit" : "read";
}

export function setTabMode(id, mode) {
  if (!state.tabs.some((t) => t.id === id && tabMode(t) !== mode)) return;
  update({ tabs: state.tabs.map((t) => (t.id === id ? { ...t, mode } : t)) });
}

export function isExpanded(path) {
  return state.expanded.includes(path);
}

export function setExpanded(path, open) {
  const has = state.expanded.includes(path);
  if (open && !has) update({ expanded: [...state.expanded, path] });
  else if (!open && has) update({ expanded: state.expanded.filter((p) => p !== path) });
}

// Expand every folder above a file path so it is visible in the tree.
export function expandAncestors(path) {
  const parts = path.split("/");
  const next = new Set(state.expanded);
  for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
  if (next.size !== state.expanded.length) update({ expanded: [...next] });
}

export function nextSort(current = state.sort) {
  return SORT_MODES[(SORT_MODES.indexOf(current) + 1) % SORT_MODES.length];
}

// ---- settings ----

export function setting(key) {
  return state.settings[key];
}

// Change one setting; a value outside its option list is ignored.
export function setSetting(key, value) {
  const options = SETTING_OPTIONS[key];
  if (!options || !options.includes(value) || state.settings[key] === value) return;
  update({ settings: { ...state.settings, [key]: value } });
}

// ---- starred notes, kept per folder root so each folder has its own list ----

export function starredIn(root) {
  return state.starred[root] || [];
}

export function isStarred(root, path) {
  return starredIn(root).includes(path);
}

export function setStarred(root, path, on) {
  const has = isStarred(root, path);
  if (on === has) return;
  const list = on ? [...starredIn(root), path] : starredIn(root).filter((p) => p !== path);
  update({ starred: { ...state.starred, [root]: list } });
}

// Rewrite the starred paths under root with fn(path) (a rename or move); a null result drops
// the entry (a delete).
export function mapStarred(root, fn) {
  const before = starredIn(root);
  const after = [...new Set(before.map(fn).filter((p) => typeof p === "string"))];
  if (after.length === before.length && after.every((p, i) => p === before[i])) return;
  update({ starred: { ...state.starred, [root]: after } });
}
