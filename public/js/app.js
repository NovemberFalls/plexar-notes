// Plexar Notes browser entry: wires the ribbon, explorer, tabs, title bar and note view
// together over state.js, and talks to the server for the tree and file contents.
import { applyIcons, icons } from "./icons.js";
import { state, update, activeTab, activePath, setExpanded, expandAncestors, nextSort, EXPLORER_MIN, EXPLORER_MAX } from "./state.js";
import { createHistory } from "./history.js";
import { createTabBar, openInTabs, newTab, closeInTabs, cycleTabs, tabTitle } from "./tabs.js";
import { createTree } from "./tree.js";
import { render } from "./render.js";
import { titleFrom, toggleTask } from "/lib/markdown.js";

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
let notePaths = []; // every .md path in the open folder, for resolving [[links]]
let current = null; // {path, content, mtime} of the note on screen

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
  notePaths = collectPaths(body.tree);
  tree.setNodes(body.tree);
}

function collectPaths(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.type === "file") out.push(node.path);
    else collectPaths(node.children, out);
  }
  return out;
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

function folderOf(path) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

// The JSON API's reply, or an Error carrying the server's message.
async function api(method, url, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const message = (data && data.error) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function showEmpty(title, hint) {
  current = null;
  $("#note-title").textContent = title;
  $("#note-body").replaceChildren();
  $("#note-body").hidden = true;
  $("#note-hint").textContent = hint;
  $("#note-hint").hidden = false;
  document.body.classList.remove("has-note");
}

function showError(err) {
  console.error("Plexar Notes:", err);
  showEmpty("Something went wrong", err && err.message ? err.message : String(err));
}

// Render a note into the column: title on top, the body below. A leading level-1 heading
// that is the title itself is dropped so it does not appear twice.
function showNote(note) {
  current = note;
  const title = titleFrom(note.content, note.path);
  $("#note-title").textContent = title;
  const body = $("#note-body");
  body.innerHTML = render(note.content, notePaths, { base: folderOf(note.path) });
  const first = body.firstElementChild;
  const plain = (s) => s.replace(/[*_`~\\]/g, "").trim();
  if (first && first.tagName === "H1" && plain(first.textContent) === plain(title)) first.remove();
  body.hidden = false;
  $("#note-hint").hidden = true;
  document.body.classList.add("has-note");
}

// Fetch and show the active tab's note.
async function showActive() {
  const tab = activeTab();
  const seq = ++loadSeq;
  treeOptions.activePath = tab ? tab.path : null;
  tree.render();
  hideConfirm();
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
    let note;
    try {
      note = await api("GET", `/api/file?path=${encodeURIComponent(tab.path)}`);
    } catch (err) {
      if (err.status === 404) err.message = `File not found: ${tab.path}`;
      throw err;
    }
    if (seq !== loadSeq) return; // another note was opened meanwhile
    showNote(note);
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

// Open a note in a tab next to the active one without switching to it (Ctrl+click).
function openNoteInBackground(path) {
  const next = openInTabs(state.tabs, state.activeTab, path);
  update({ tabs: next.tabs });
  renderTabs();
}

// ---- reading view interactions: links, anchors, copy buttons, task checkboxes ----

const noteBody = $("#note-body");

noteBody.addEventListener("click", (event) => {
  const copy = event.target.closest(".copy");
  if (copy && noteBody.contains(copy)) {
    copyCode(copy);
    return;
  }
  const link = event.target.closest("a");
  if (!link || !noteBody.contains(link)) return;
  if (link.classList.contains("wikilink")) {
    event.preventDefault();
    const path = link.dataset.path;
    if (path) {
      if (event.ctrlKey || event.metaKey) openNoteInBackground(path);
      else openNote(path);
    } else {
      askToCreate(link.dataset.target || link.textContent.trim());
    }
    return;
  }
  const href = link.getAttribute("href") || "";
  if (href.startsWith("#")) {
    event.preventDefault();
    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {}
    const target = id && document.getElementById(id);
    if (target && $("#note").contains(target)) target.scrollIntoView({ block: "start", behavior: "smooth" });
  }
});

async function copyCode(button) {
  const code = button.parentElement.querySelector("pre code");
  const text = code ? code.textContent : "";
  const label = button.querySelector(".copy-label");
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Plexar Notes: copy failed", err);
    return;
  }
  button.classList.add("copied");
  if (label) label.textContent = "Copied";
  clearTimeout(button._copiedTimer);
  button._copiedTimer = setTimeout(() => {
    button.classList.remove("copied");
    if (label) label.textContent = "Copy";
  }, 1500);
}

// A task checkbox flips the matching "[ ]" / "[x]" in the source and saves the file.
noteBody.addEventListener("change", async (event) => {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || box.type !== "checkbox" || !current) return;
  const boxes = Array.from(noteBody.querySelectorAll('input[type="checkbox"]'));
  const index = boxes.indexOf(box);
  if (index === -1) return;
  const note = current;
  const content = toggleTask(note.content, index, box.checked);
  const item = box.closest("li");
  if (item) item.classList.toggle("task-done", box.checked);
  try {
    const reply = await api("PUT", "/api/file", { path: note.path, content });
    note.content = content;
    if (reply && reply.mtime) note.mtime = reply.mtime;
  } catch (err) {
    console.error("Plexar Notes: could not save task", err);
    box.checked = !box.checked;
    if (item) item.classList.toggle("task-done", box.checked);
  }
});

// ---- the confirm bar: create a note for a [[link]] that has no file yet ----

const confirmBar = $("#confirm-bar");
let pendingCreate = null;

function hideConfirm() {
  confirmBar.hidden = true;
  pendingCreate = null;
}

function askToCreate(name) {
  if (!name || !current) return;
  pendingCreate = { name, folder: folderOf(current.path) };
  $("#confirm-text").textContent = `Create "${name}"?`;
  confirmBar.hidden = false;
  $("#confirm-create").focus();
}

$("#confirm-cancel").addEventListener("click", hideConfirm);
$("#confirm-create").addEventListener("click", async () => {
  if (!pendingCreate) return;
  const { name, folder } = pendingCreate;
  const path = folder ? `${folder}/${name}` : name;
  try {
    const reply = await api("POST", "/api/file", { path, content: `# ${name}\n` });
    hideConfirm();
    await loadTree();
    openNote(reply.path);
  } catch (err) {
    console.error("Plexar Notes: could not create note", err);
    $("#confirm-text").textContent = `Could not create "${name}": ${err.message}`;
  }
});
confirmBar.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideConfirm();
});

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
