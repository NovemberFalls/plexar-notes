// Plexar Notes browser entry: wires the ribbon, explorer, tabs, title bar and note view
// together over state.js, and talks to the server for the tree and file contents.
import { applyIcons } from "./icons.js";
import {
  state, update, activeTab, activePath, setExpanded, expandAncestors, nextSort, tabMode, setTabMode,
  setting, starredIn, isStarred, setStarred, mapStarred, EXPLORER_MIN, EXPLORER_MAX,
} from "./state.js";
import { createHistory } from "./history.js";
import { createTabBar, openInTabs, newTab, closeInTabs, cycleTabs, tabTitle } from "./tabs.js";
import { createTree } from "./tree.js";
import { render } from "./render.js";
import { createEditor, applyModeButton } from "./editor.js";
import { createSearch } from "./search.js";
import { createBacklinks } from "./backlinks.js";
import { createSettings } from "./settings.js";
import { createStarredPanel } from "./starred.js";
import { openMenu, confirmDialog, pickFolder, pickSystemFolder } from "./menu.js";
import { titleFrom, toggleTask } from "/lib/markdown.js";
import { createAutosave } from "/lib/autosave.js";
import { stats } from "/lib/words.js";

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
let treeNodes = []; // the nested tree as /api/tree gave it, for the 'Move to' dialog
let currentRoot = ""; // absolute path of the open folder, where the folder picker starts
let current = null; // {path, content, mtime} of the note on screen

// ---- explorer: tree, header buttons, footer ----

const treeOptions = {
  expanded,
  activePath: activePath(),
  showExtensions: setting("showExtensions"),
  onOpen: (path) => openNote(path),
  onToggle: (path, open) => {
    if (open) expanded.add(path);
    else expanded.delete(path);
    setExpanded(path, open);
  },
  onContextMenu: (node, event) => showTreeMenu(node, event),
  onRename: (path, name) => renameItem(path, name),
  onCreateFolder: (parent, name) => createFolder(parent, name),
};
const tree = createTree($("#tree"), treeOptions);

async function loadTree() {
  const res = await fetch(`/api/tree?sort=${encodeURIComponent(state.sort)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  $("#folder-name").textContent = body.folder;
  $("#folder-name").title = body.root ? `Open folder: ${body.root}` : "Open folder";
  document.title = `${body.folder} · Plexar Notes`;
  currentRoot = body.root || "";
  settings.setFolder(currentRoot || body.folder);
  treeNodes = body.tree;
  notePaths = collectPaths(body.tree);
  tree.setNodes(body.tree);
  renderStarred();
}

function collectPaths(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.type === "file") out.push(node.path);
    else collectPaths(node.children, out);
  }
  return out;
}

function applySortLabel() {
  $("#sort").dataset.tip = SORT_LABELS[state.sort];
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

$("#new-note").addEventListener("click", () => createNote(targetFolder()));
$("#new-folder").addEventListener("click", () => startNewFolder(targetFolder()));

// The bottom of the panel: open another folder, and the same settings dialog the ribbon opens.
$("#open-folder").addEventListener("click", () => openAnotherFolder());
$("#folder-settings").addEventListener("click", (event) => settings.open(event.currentTarget));

// ---- settings: the dialog, and what each change does beyond the CSS ----

const settings = createSettings($("#settings"), {
  onChange: (key, value) => {
    if (key === "autosave") autosave.setDelay(value);
    if (key === "showExtensions") {
      treeOptions.showExtensions = value;
      tree.render();
    }
  },
});
$("#ribbon-settings").addEventListener("click", (event) => settings.toggle(event.currentTarget));

// ---- starred notes: the star on the note and the Starred panel ----

const starToggle = $("#star-toggle");
const starredPanel = createStarredPanel($("#starred-list"), {
  onOpen: (path) => openNote(path),
  onRemove: (path) => {
    setStarred(currentRoot, path, false);
    renderStarred();
    applyStar();
  },
});

function renderStarred() {
  starredPanel.render(starredIn(currentRoot), activePath());
}

// The star on the note reflects whether the note on screen is starred.
function applyStar() {
  const path = current ? current.path : null;
  const on = Boolean(path) && isStarred(currentRoot, path);
  starToggle.hidden = !path;
  starToggle.classList.toggle("starred", on);
  starToggle.setAttribute("aria-pressed", on ? "true" : "false");
  starToggle.setAttribute("aria-label", on ? "Unstar this note" : "Star this note");
  starToggle.dataset.tip = on ? "Unstar" : "Star";
}

starToggle.addEventListener("click", () => {
  if (!current) return;
  setStarred(currentRoot, current.path, !isStarred(currentRoot, current.path));
  applyStar();
  renderStarred();
});

// ---- file operations: new note, new folder, rename, move, delete, open folder ----

function baseName(path) {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

function joinPath(folder, name) {
  return folder ? `${folder}/${name}` : name;
}

// The folder a header button acts on: the selected folder, the selected note's folder, else
// the top level. Only a real selection counts; keyboard focus alone does not.
function targetFolder() {
  const selected = tree.selected();
  if (!selected) return "";
  return selected.type === "folder" ? selected.path : folderOf(selected.path);
}

// 'Untitled', then 'Untitled 2', 'Untitled 3', ... the first that is free in folder.
function untitledName(folder) {
  const taken = new Set(notePaths.filter((p) => folderOf(p) === folder).map((p) => baseName(p).toLowerCase()));
  for (let n = 1; ; n++) {
    const name = n === 1 ? "Untitled" : `Untitled ${n}`;
    if (!taken.has(`${name}.md`.toLowerCase())) return name;
  }
}

// Open a folder and every folder above it in the tree.
function expandFolder(folder) {
  if (!folder) return;
  const parts = folder.split("/");
  const next = new Set(state.expanded);
  for (let i = 1; i <= parts.length; i++) next.add(parts.slice(0, i).join("/"));
  for (const p of next) expanded.add(p);
  update({ expanded: [...next] });
}

// Something failed: say so in a card, never in the console alone.
function reportError(title, err) {
  console.error(`Plexar Notes: ${title}`, err);
  return confirmDialog({ title, text: err && err.message ? err.message : String(err), confirmLabel: "OK" });
}

function badName(name) {
  return /[\\/]/.test(name) ? new Error("A name cannot contain / or \\.") : null;
}

// Make an empty note in folder, open it for editing, and put its name in the tree up for
// renaming so the first thing typed is the title.
async function createNote(folder) {
  const path = joinPath(folder, `${untitledName(folder)}.md`);
  try {
    const reply = await api("POST", "/api/file", { path, content: "" });
    expandFolder(folder);
    await loadTree();
    await openNote(reply.path, { mode: "edit" });
    tree.startRename(reply.path);
  } catch (err) {
    reportError("Could not create the note", err);
  }
}

function startNewFolder(parent) {
  expandFolder(parent);
  tree.startNewFolder(parent);
}

async function createFolder(parent, name) {
  const bad = badName(name);
  if (bad) {
    tree.render();
    return reportError("Could not create the folder", bad);
  }
  try {
    const reply = await api("POST", "/api/folder", { path: joinPath(parent, name) });
    expandFolder(parent);
    await loadTree();
    tree.focus(reply.path);
  } catch (err) {
    tree.render();
    reportError("Could not create the folder", err);
  }
}

// The inline rename confirmed: a note keeps its .md whatever was typed.
async function renameItem(path, name) {
  const node = tree.node(path);
  if (!node) return;
  const bad = badName(name);
  if (bad) {
    tree.render();
    return reportError("Could not rename", bad);
  }
  const fileName = node.type === "file" && !/\.md$/i.test(name) ? `${name}.md` : name;
  const to = joinPath(folderOf(path), fileName);
  if (to === path) {
    tree.render();
    return;
  }
  await movePath(node, to, "Could not rename");
}

// 'Move to…': pick a folder from the tree, then move the item there under its own name.
async function moveWithDialog(node) {
  const dest = await pickFolder(treeNodes, {
    title: `Move "${node.name}" to`,
    rootName: $("#folder-name").textContent,
    exclude: node.type === "folder" ? node.path : null,
    current: folderOf(node.path),
  });
  if (dest === null) return;
  const to = joinPath(dest, baseName(node.path));
  if (to === node.path) return;
  await movePath(node, to, "Could not move");
}

// Rename or move node to the path to, then follow it in the tabs, the tree and the history.
async function movePath(node, to, failTitle) {
  try {
    await autosave.flush();
    const reply = await api("POST", "/api/rename", { from: node.path, to });
    afterPathChange(node.path, reply.path, node.type === "folder");
    await loadTree();
    tree.focus(reply.path);
  } catch (err) {
    tree.render();
    reportError(failTitle, err);
  }
}

// Everything that remembered a path under from now points at the same place under to.
function afterPathChange(from, to, isFolder) {
  const mapPath = (p) => {
    if (p === from) return to;
    if (isFolder && p.startsWith(`${from}/`)) return to + p.slice(from.length);
    return p;
  };
  const tabs = state.tabs.map((t) => (t.path && mapPath(t.path) !== t.path ? { ...t, path: mapPath(t.path) } : t));
  const nextExpanded = [...new Set(state.expanded.map(mapPath))];
  expanded.clear();
  for (const p of nextExpanded) expanded.add(p);
  update({ tabs, expanded: nextExpanded });
  navHistory.map(mapPath);
  mapStarred(currentRoot, mapPath);
  if (lastSave.path) lastSave = { ...lastSave, path: mapPath(lastSave.path) };
  if (current && mapPath(current.path) !== current.path) {
    current.path = mapPath(current.path);
    $("#note-title").textContent = titleFrom(current.content, current.path);
  }
  if (current) backlinks.refresh(current.path);
  treeOptions.activePath = activePath();
  renderTabs();
  updateNav();
}

// Ask, then delete the note or folder and close whatever tabs were showing it.
async function deleteItem(node) {
  const ok = await confirmDialog({
    title: node.type === "folder" ? "Delete folder" : "Delete note",
    text: `Delete "${node.name}"? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!ok) return;
  try {
    await autosave.flush();
    const route = node.type === "folder" ? "/api/folder" : "/api/file";
    await api("DELETE", `${route}?path=${encodeURIComponent(node.path)}`);
    forgetPath(node.path, node.type === "folder");
    await loadTree();
    showActive();
  } catch (err) {
    reportError("Could not delete", err);
  }
}

// Close the tabs on a deleted path (and, for a folder, on everything inside it) and drop it
// from the history and the expanded folders.
function forgetPath(path, isFolder) {
  const gone = (p) => Boolean(p) && (p === path || (isFolder && p.startsWith(`${path}/`)));
  let { tabs, activeTab: active } = state;
  for (const t of state.tabs) {
    if (!gone(t.path)) continue;
    ({ tabs, activeTab: active } = closeInTabs(tabs, active, t.id));
    navHistory.remove(t.path);
  }
  const nextExpanded = state.expanded.filter((p) => !gone(p));
  expanded.clear();
  for (const p of nextExpanded) expanded.add(p);
  update({ tabs, activeTab: active, expanded: nextExpanded });
  mapStarred(currentRoot, (p) => (gone(p) ? null : p));
  renderTabs();
  updateNav();
}

// The right-click menu on a tree item.
function showTreeMenu(node, event) {
  const items = [];
  if (node.type === "folder") items.push({ label: "New note here", onSelect: () => createNote(node.path) }, { separator: true });
  items.push(
    { label: "Rename", onSelect: () => tree.startRename(node.path) },
    { label: "Move to…", onSelect: () => moveWithDialog(node) },
    { separator: true },
    { label: "Delete", danger: true, onSelect: () => deleteItem(node) },
  );
  const from = event.target && event.target.closest ? event.target.closest(".tree-item") : null;
  openMenu(items, { x: event.clientX, y: event.clientY, restoreFocus: from });
}

// Pick a folder on this machine and serve from it: the tabs close, the tree reloads and the
// name at the bottom of the panel changes.
async function openAnotherFolder() {
  const listFolders = (p) => api("GET", `/api/folders?path=${encodeURIComponent(p || "")}`);
  const chosen = await pickSystemFolder(listFolders, { start: currentRoot });
  if (!chosen) return;
  try {
    await autosave.flush();
    await api("POST", "/api/open-folder", { folder: chosen });
  } catch (err) {
    reportError("Could not open the folder", err);
    return;
  }
  expanded.clear();
  update({ tabs: [], activeTab: null, expanded: [] });
  navHistory.clear();
  current = null;
  lastSave = { state: "saved", path: null };
  treeOptions.activePath = null;
  renderTabs();
  try {
    await loadTree();
    showActive();
    updateNav();
  } catch (err) {
    showError(err);
  }
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

// The ribbon marks the panel that is showing; the settings button is not a panel switch.
function applyExplorer() {
  document.body.classList.toggle("explorer-hidden", !state.explorerOpen);
  for (const btn of document.querySelectorAll(".ribbon-btn[data-panel]")) {
    const on = state.explorerOpen && btn.dataset.panel === state.ribbon;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  for (const panel of document.querySelectorAll("#explorer .panel")) {
    panel.hidden = panel.dataset.panel !== state.ribbon;
  }
}

for (const btn of document.querySelectorAll(".ribbon-btn[data-panel]")) {
  btn.addEventListener("click", () => {
    const panel = btn.dataset.panel;
    if (state.explorerOpen && state.ribbon === panel) update({ explorerOpen: false });
    else update({ ribbon: panel, explorerOpen: true });
    applyExplorer();
    if (panel === "search") search.focus("text");
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

// The JSON API's reply, or an Error carrying the server's message. extra merges into the
// fetch init (for example keepalive on a save that must outlive the page).
async function api(method, url, body, extra = {}) {
  const init = { method, ...extra };
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
  editor.hide();
  newNoteForm.hidden = true;
  modeToggle.hidden = true;
  applyStar();
  $("#note-hint").textContent = hint;
  $("#note-hint").hidden = false;
  document.body.classList.remove("has-note", "editing");
  showStats("");
  showSaved("saved");
  backlinks.refresh(null);
  renderStarred();
}

// The empty tab: a name box that creates a note in the folder root and opens it for editing.
function showNewNotePrompt() {
  showEmpty("New note", "");
  $("#note-hint").hidden = true;
  setNewNoteHint(null);
  $("#new-note-name").value = "";
  newNoteForm.hidden = false;
  $("#new-note-name").focus();
}

function showError(err) {
  console.error("Plexar Notes:", err);
  showEmpty("Something went wrong", err && err.message ? err.message : String(err));
}

// Render a note into the column: title on top, the body below. A leading level-1 heading
// that is the title itself is dropped so it does not appear twice.
function showNote(note, mode = "read") {
  current = note;
  const title = titleFrom(note.content, note.path);
  $("#note-title").textContent = title;
  const body = $("#note-body");
  newNoteForm.hidden = true;
  $("#note-hint").hidden = true;
  modeToggle.hidden = false;
  applyModeButton(modeToggle, mode);
  applyStar();
  renderStarred();
  document.body.classList.add("has-note");
  document.body.classList.toggle("editing", mode === "edit");
  if (mode === "edit") {
    body.replaceChildren();
    body.hidden = true;
    editor.load(note.content);
    editor.show();
  } else {
    editor.hide();
    body.innerHTML = render(note.content, notePaths, { base: folderOf(note.path) });
    const first = body.firstElementChild;
    const plain = (s) => s.replace(/[*_`~\\]/g, "").trim();
    if (first && first.tagName === "H1" && plain(first.textContent) === plain(title)) first.remove();
    body.hidden = false;
  }
  showStats(note.content);
  showSaved(lastSave.path === note.path ? lastSave.state : "saved");
}

// Fetch and show the active tab's note.
async function showActive() {
  const tab = activeTab();
  const seq = ++loadSeq;
  // Anything typed into the note on screen goes out before the next view replaces it.
  const flushed = autosave.flush();
  treeOptions.activePath = tab ? tab.path : null;
  tree.render();
  hideConfirm();
  if (!tab) {
    showEmpty("No file is open", "Pick a file in the explorer, or press Ctrl+P to search.");
    return;
  }
  if (!tab.path) {
    showNewNotePrompt();
    return;
  }
  $("#note-title").textContent = tabTitle(tab);
  try {
    await flushed; // so the read below sees the write
    if (seq !== loadSeq) return;
    let note;
    try {
      note = await api("GET", `/api/file?path=${encodeURIComponent(tab.path)}`);
    } catch (err) {
      if (err.status === 404) err.message = `File not found: ${tab.path}`;
      throw err;
    }
    if (seq !== loadSeq) return; // another note was opened meanwhile
    showNote(note, tabMode(tab));
    $("#note").scrollTop = 0;
    tree.reveal(tab.path);
    backlinks.refresh(note.path);
  } catch (err) {
    if (seq === loadSeq) showError(err);
  }
}

// options.mode: 'edit' opens the note straight into edit mode. Resolves once the note is on
// screen (or its error is), so a caller can act on the rendered view.
function openNote(path, { record = true, mode } = {}) {
  expandAncestors(path);
  for (const p of state.expanded) expanded.add(p);
  update(openInTabs(state.tabs, state.activeTab, path));
  if (mode) setTabMode(state.activeTab, mode);
  if (record) navHistory.push(path);
  renderTabs();
  const shown = showActive();
  updateNav();
  return shown;
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
    if (current === note) backlinks.refresh(note.path);
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

// ---- status bar: word count and the saved indicator ----

// Call fn at most once per ms, always ending with the latest arguments.
function throttle(fn, ms) {
  let timer = null;
  let last = 0;
  let args = null;
  return (...next) => {
    args = next;
    const wait = ms - (Date.now() - last);
    if (wait <= 0) {
      last = Date.now();
      fn(...args);
    } else if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...args);
      }, wait);
    }
  };
}

const showStats = throttle((markdown) => {
  const { words, chars } = stats(markdown);
  $("#status-words").textContent = `Words: ${words} · Characters: ${chars}`;
}, 250);

const SAVED_TEXT = { saved: "Saved", dirty: "Unsaved changes", saving: "Saving…", error: "Save failed" };
let lastSave = { state: "saved", path: null }; // the newest autosave state, and whose it is

function showSaved(saveState) {
  const el = $("#status-saved");
  const s = SAVED_TEXT[saveState] ? saveState : "saved";
  el.className = `status-saved state-${s}`;
  $("#status-saved-text").textContent = SAVED_TEXT[s];
}

// ---- backlinks: the count in the status bar and the 'Linked mentions' panel ----

const backlinks = createBacklinks($("#status-backlinks"), $("#backlinks"), {
  fetch: (path) => api("GET", `/api/backlinks?path=${encodeURIComponent(path)}`),
  onOpen: (path) => openNote(path),
});

// ---- editing: the textarea, autosave and the mode toggle ----

const autosave = createAutosave({
  delay: setting("autosave"),
  save: async (path, content) => {
    // keepalive lets a save outlive a closing page, but browsers cap such bodies at 64 KB,
    // so it is only asked for when the page is going away and the note is small.
    const keepalive = document.visibilityState === "hidden" && content.length < 30000;
    const reply = await api("PUT", "/api/file", { path, content }, { keepalive });
    if (current && current.path === path) {
      if (reply && reply.mtime) current.mtime = reply.mtime;
      backlinks.refresh(path);
    }
  },
  onState: (saveState, path) => {
    lastSave = { state: saveState, path };
    if (saveState === "error") console.error("Plexar Notes: could not save", path);
    if (current && current.path === path) showSaved(saveState);
  },
});

const editor = createEditor($("#note-editor"), {
  onInput: (value) => {
    if (!current) return;
    current.content = value;
    autosave.change(current.path, value);
    showStats(value);
  },
});

const modeToggle = $("#mode-toggle");
const newNoteForm = $("#new-note-form");

function currentMode() {
  return tabMode(activeTab());
}

// Switch the active note between reading and editing; leaving edit mode saves and re-renders.
function setMode(mode) {
  const tab = activeTab();
  if (!tab || !tab.path || !current || current.path !== tab.path) return;
  if (mode === currentMode()) return;
  setTabMode(tab.id, mode);
  if (mode === "edit") {
    showNote(current, "edit");
    editor.focus();
  } else {
    current.content = editor.value();
    autosave.flush();
    showNote(current, "read");
    modeToggle.focus();
  }
}

modeToggle.addEventListener("click", () => setMode(currentMode() === "edit" ? "read" : "edit"));

// ---- the 'New note' prompt on an empty tab ----

function setNewNoteHint(error) {
  const hint = $("#new-note-hint");
  hint.textContent = error || "Press Enter to create the note in the folder root and start writing.";
  hint.classList.toggle("is-error", Boolean(error));
}

newNoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#new-note-name");
  const name = input.value.trim().replace(/\.md$/i, "");
  if (!name) {
    setNewNoteHint("Give the note a name first.");
    input.focus();
    return;
  }
  if (/[\\/]/.test(name)) {
    setNewNoteHint("A note name cannot contain / or \\; it goes in the folder root.");
    input.focus();
    return;
  }
  input.disabled = true;
  try {
    const reply = await api("POST", "/api/file", { path: name, content: `# ${name}\n` });
    await loadTree();
    openNote(reply.path, { mode: "edit" });
  } catch (err) {
    console.error("Plexar Notes: could not create note", err);
    setNewNoteHint(err.status === 409 ? `"${name}" already exists.` : `Could not create "${name}": ${err.message}`);
    input.focus();
  } finally {
    input.disabled = false;
  }
});

// ---- search: the title bar box, and the jump to the matching block in the reading view ----

const BLOCKS = "h1, h2, h3, h4, h5, h6, p, li, tr, pre, blockquote";
let jumpTimer = null;

// A snippet as the reader would see it: link and emphasis markers, list bullets, task boxes,
// table pipes and inline tags gone, whitespace collapsed, lower-cased.
function plainSnippet(text) {
  return String(text || "")
    .replace(/…/g, " ")
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (m, target, alias) => alias || target)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^[\s>#*\-+|]+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^\[[ xX]\]\s*/, "")
    .replace(/[*_`~\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// The first rendered block whose text holds the snippet, else the first holding every query
// word, else null.
function findBlock(body, match, query) {
  const blocks = Array.from(body.querySelectorAll(BLOCKS));
  const textOf = (el) => el.textContent.replace(/\s+/g, " ").trim().toLowerCase();
  const wanted = match ? plainSnippet(match.text) : "";
  if (wanted) {
    const hit = blocks.find((el) => textOf(el).includes(wanted));
    if (hit) return hit;
  }
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return blocks.find((el) => {
    const text = textOf(el);
    return words.every((w) => text.includes(w));
  }) || null;
}

// Open a note from a search result and, in reading view, scroll to where the hit is.
async function openNoteAt(path, match, query) {
  await openNote(path);
  if (!current || current.path !== path || currentMode() !== "read") return;
  const target = findBlock(noteBody, match, query);
  if (!target) return;
  target.scrollIntoView({ block: "center" });
  for (const el of noteBody.querySelectorAll(".search-target")) el.classList.remove("search-target");
  target.classList.add("search-target");
  clearTimeout(jumpTimer);
  jumpTimer = setTimeout(() => target.classList.remove("search-target"), 1600);
}

const search = createSearch($("#search"), $("#search-results"), { onOpen: openNoteAt });

// ---- keyboard shortcuts ----

document.addEventListener("keydown", (event) => {
  const ctrl = event.ctrlKey || event.metaKey;
  if (!ctrl) return;
  const key = event.key.toLowerCase();
  if (key === "p" && !event.shiftKey) {
    event.preventDefault();
    search.focus("file");
  } else if (key === "f" && event.shiftKey) {
    event.preventDefault();
    search.focus("text");
  } else if (key === "e" && !event.shiftKey) {
    if (!current) return;
    event.preventDefault();
    setMode(currentMode() === "edit" ? "read" : "edit");
  } else if (key === "s" && !event.shiftKey) {
    event.preventDefault();
    autosave.flush();
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

// Whatever is still dirty goes out when the page is left or hidden.
window.addEventListener("pagehide", () => {
  autosave.flush();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") autosave.flush();
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
