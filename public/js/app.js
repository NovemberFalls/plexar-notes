// Plexar Notes browser entry: wires the ribbon, explorer, tabs, title bar and note view
// together over state.js, and talks to the server for the tree and file contents.
import { applyIcons, icons } from "./icons.js";
import { state, update, activeTab, activePath, setExpanded, expandAncestors, nextSort, EXPLORER_MIN, EXPLORER_MAX } from "./state.js";
import { createHistory } from "./history.js";
import { createTabBar, openInTabs, newTab, closeInTabs, cycleTabs, tabTitle } from "./tabs.js";
import { createTree } from "./tree.js";

const SORT_LABELS = {
  "name-asc": "Sort: file name (A to Z)",
  "name-desc": "Sort: file name (Z to A)",
  "modified-desc": "Sort: modified time (new to old)",
  "modified-asc": "Sort: modified time (old to new)",
};

const $ = (sel) => document.querySelector(sel);

applyIcons();

const navHistory = createHistory();
const expanded = new Set(state.expanded);
let loadSeq = 0;

// ---- explorer: tree, header buttons, footer ----

const treeOptions = {
  expanded,
  activePath: activePath(),
  onOpen: (path) => openNote(path),
  onToggle: (path, open) => {
    if (open) expanded.add(path);
    else expanded.delete(path);
    setExpanded(path, open);
  },
};
const tree = createTree($("#tree"), treeOptions);

async function loadTree() {
  const res = await fetch(`/api/tree?sort=${encodeURIComponent(state.sort)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  $("#folder-name").textContent = body.folder;
  $("#folder-name").title = body.root ? `Open folder: ${body.root}` : "Open folder";
  document.title = `${body.folder} · Plexar Notes`;
  tree.setNodes(body.tree);
}

function applySortLabel() {
  $("#sort").title = SORT_LABELS[state.sort];
}
$("#sort").addEventListener("click", async () => {
  update({ sort: nextSort() });
  applySortLabel();
  await loadTree().catch(showError);
});
applySortLabel();

$("#collapse-all").addEventListener("click", () => {
  expanded.clear();
  update({ expanded: [] });
  tree.render();
});

// Placeholders until the file operations task: they exist, have tooltips, and do nothing yet.
for (const id of ["#new-note", "#new-folder", "#open-folder", "#folder-settings"]) {
  $(id).addEventListener("click", () => {});
}

// ---- explorer width and visibility ----

function applyExplorerWidth(width) {
  document.documentElement.style.setProperty("--explorer-width", `${width}px`);
}
applyExplorerWidth(state.explorerWidth);

const resizer = $("#explorer-resizer");
resizer.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = state.explorerWidth;
  let width = startWidth;
  resizer.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing");
  const move = (e) => {
    width = Math.min(EXPLORER_MAX, Math.max(EXPLORER_MIN, startWidth + (e.clientX - startX)));
    applyExplorerWidth(width);
  };
  const stop = () => {
    resizer.removeEventListener("pointermove", move);
    resizer.removeEventListener("pointerup", stop);
    resizer.removeEventListener("pointercancel", stop);
    document.body.classList.remove("resizing");
    update({ explorerWidth: width });
  };
  resizer.addEventListener("pointermove", move);
  resizer.addEventListener("pointerup", stop);
  resizer.addEventListener("pointercancel", stop);
});

function applyExplorer() {
  document.body.classList.toggle("explorer-hidden", !state.explorerOpen);
  for (const btn of document.querySelectorAll(".ribbon-btn")) {
    const on = state.explorerOpen && btn.dataset.panel === state.ribbon;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  for (const panel of document.querySelectorAll("#explorer .panel")) {
    panel.hidden = panel.dataset.panel !== state.ribbon;
  }
}

for (const btn of document.querySelectorAll(".ribbon-btn")) {
  btn.addEventListener("click", () => {
    const panel = btn.dataset.panel;
    if (state.explorerOpen && state.ribbon === panel) update({ explorerOpen: false });
    else update({ ribbon: panel, explorerOpen: true });
    applyExplorer();
  });
}
applyExplorer();

// ---- tabs and history ----

const tabBar = createTabBar($("#tabbar"), {
  onSelect: (id) => selectTab(id),
  onClose: (id) => closeTab(id),
  onNew: () => {
    update(newTab(state.tabs));
    renderTabs();
    showActive();
  },
});

function renderTabs() {
  tabBar.render(state.tabs, state.activeTab);
}

function selectTab(id) {
  if (id === state.activeTab) return;
  update({ activeTab: id });
  renderTabs();
  showActive();
  const path = activePath();
  if (path) navHistory.push(path);
  updateNav();
}

function closeTab(id) {
  const closing = state.tabs.find((t) => t.id === id);
  update(closeInTabs(state.tabs, state.activeTab, id));
  if (closing && closing.path && !state.tabs.some((t) => t.path === closing.path)) navHistory.remove(closing.path);
  renderTabs();
  showActive();
  updateNav();
}

function updateNav() {
  $("#nav-back").disabled = !navHistory.canBack();
  $("#nav-forward").disabled = !navHistory.canForward();
}

$("#nav-back").addEventListener("click", () => {
  const path = navHistory.back();
  if (path) openNote(path, { record: false });
});
$("#nav-forward").addEventListener("click", () => {
  const path = navHistory.forward();
  if (path) openNote(path, { record: false });
});

// ---- note view ----

function fileUrl(path) {
  return "/files/" + path.split("/").map(encodeURIComponent).join("/");
}

function showEmpty(title, hint) {
  $("#note-title").textContent = title;
  $("#note-body").textContent = "";
  $("#note-body").hidden = true;
  $("#note-hint").textContent = hint;
  $("#note-hint").hidden = false;
  document.body.classList.remove("has-note");
}

function showError(err) {
  console.error("Plexar Notes:", err);
  showEmpty("Something went wrong", err && err.message ? err.message : String(err));
}

// Fetch and show the active tab's note (raw Markdown for now).
async function showActive() {
  const tab = activeTab();
  const seq = ++loadSeq;
  treeOptions.activePath = tab ? tab.path : null;
  tree.render();
  if (!tab) {
    showEmpty("No file is open", "Pick a file in the explorer, or press Ctrl+P to search.");
    return;
  }
  if (!tab.path) {
    showEmpty("New tab", "Pick a file in the explorer to open it here.");
    return;
  }
  $("#note-title").textContent = tabTitle(tab);
  try {
    const res = await fetch(fileUrl(tab.path));
    if (seq !== loadSeq) return; // another note was opened meanwhile
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        message = (await res.json()).error || message;
      } catch {}
      throw new Error(res.status === 404 ? `File not found: ${tab.path}` : message);
    }
    const text = await res.text();
    if (seq !== loadSeq) return;
    $("#note-body").textContent = text;
    $("#note-body").hidden = false;
    $("#note-hint").hidden = true;
    document.body.classList.add("has-note");
    $("#note").scrollTop = 0;
    tree.reveal(tab.path);
  } catch (err) {
    if (seq === loadSeq) showError(err);
  }
}

function openNote(path, { record = true } = {}) {
  expandAncestors(path);
  for (const p of state.expanded) expanded.add(p);
  update(openInTabs(state.tabs, state.activeTab, path));
  if (record) navHistory.push(path);
  renderTabs();
  showActive();
  updateNav();
}

// Reading / edit toggle: a placeholder until editing lands.
const modeToggle = $("#mode-toggle");
modeToggle.addEventListener("click", () => {
  const editing = document.body.classList.toggle("editing");
  modeToggle.innerHTML = editing ? icons.pencil : icons.bookOpen;
  modeToggle.title = editing ? "Edit mode" : "Reading mode";
});

// ---- keyboard shortcuts ----

document.addEventListener("keydown", (event) => {
  const ctrl = event.ctrlKey || event.metaKey;
  if (!ctrl) return;
  const key = event.key.toLowerCase();
  if ((key === "p" && !event.shiftKey) || (key === "f" && event.shiftKey)) {
    event.preventDefault();
    $("#search").focus();
    $("#search").select();
  } else if (key === "w" && !event.shiftKey) {
    if (!state.activeTab) return;
    event.preventDefault();
    closeTab(state.activeTab);
  } else if (key === "tab") {
    event.preventDefault();
    const next = cycleTabs(state.tabs, state.activeTab, event.shiftKey ? -1 : 1);
    if (next) selectTab(next);
  }
});

// ---- start ----

renderTabs();
loadTree()
  .then(() => {
    showActive();
    const path = activePath();
    if (path) navHistory.push(path);
    updateNav();
  })
  .catch(showError);
