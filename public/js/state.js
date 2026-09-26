// App state for Plexar Notes: open tabs, the active tab, the sort mode, which folders are
// expanded and how the window is arranged. Everything here survives a reload through
// localStorage; nothing here touches the DOM.

const STORAGE_KEY = "plexar-notes.state";
export const SORT_MODES = ["name-asc", "name-desc", "modified-desc", "modified-asc"];
export const EXPLORER_MIN = 180;
export const EXPLORER_MAX = 480;

const DEFAULTS = {
  tabs: [], // [{id, path}] where path is null for an empty 'New tab'
  activeTab: null, // id of the active tab
  sort: "name-asc",
  expanded: [], // folder paths that are open in the tree
  explorerWidth: 260,
  explorerOpen: true,
  ribbon: "files", // which ribbon panel is showing
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
        .map((t) => ({ id: t.id, path: typeof t.path === "string" ? t.path : null }))
    : [];
  if (!s.tabs.some((t) => t.id === s.activeTab)) s.activeTab = s.tabs.length ? s.tabs[0].id : null;
  if (!SORT_MODES.includes(s.sort)) s.sort = DEFAULTS.sort;
  s.expanded = Array.isArray(s.expanded) ? s.expanded.filter((p) => typeof p === "string") : [];
  const w = Number(s.explorerWidth);
  s.explorerWidth = Number.isFinite(w) ? Math.min(EXPLORER_MAX, Math.max(EXPLORER_MIN, w)) : DEFAULTS.explorerWidth;
  s.explorerOpen = s.explorerOpen !== false;
  if (typeof s.ribbon !== "string") s.ribbon = DEFAULTS.ribbon;
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
