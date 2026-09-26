// Plexar Notes browser entry: wires the ribbon, explorer, tabs, title bar and note view
// together over state.js, and talks to the server for the tree and file contents.
import { applyIcons } from "./icons.js";
import { state, update, activeTab, activePath, setExpanded, expandAncestors, nextSort, tabMode, setTabMode, EXPLORER_MIN, EXPLORER_MAX } from "./state.js";
import { createHistory } from "./history.js";
import { createTabBar, openInTabs, newTab, closeInTabs, cycleTabs, tabTitle } from "./tabs.js";
import { createTree } from "./tree.js";
import { render } from "./render.js";
import { createEditor, applyModeButton } from "./editor.js";
import { createSearch } from "./search.js";
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
  $("#note-hint").textContent = hint;
  $("#note-hint").hidden = false;
  document.body.classList.remove("has-note", "editing");
  showStats("");
  showSaved("saved");
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

// ---- editing: the textarea, autosave and the mode toggle ----

const autosave = createAutosave({
  delay: 800,
  save: async (path, content) => {
    // keepalive lets a save outlive a closing page, but browsers cap such bodies at 64 KB,
    // so it is only asked for when the page is going away and the note is small.
    const keepalive = document.visibilityState === "hidden" && content.length < 30000;
    const reply = await api("PUT", "/api/file", { path, content }, { keepalive });
    if (current && current.path === path && reply && reply.mtime) current.mtime = reply.mtime;
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
