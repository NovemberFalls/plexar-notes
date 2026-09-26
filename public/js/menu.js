// In-app menus and dialogs for Plexar Notes: the right-click menu on a tree item, the confirm
// card, the 'Move to' folder list and the folder picker for opening another folder. Nothing
// here uses window.prompt or window.confirm; every popup is an element on var(--px-elev),
// closes on Escape, and text only ever goes in through textContent.
import { icons } from "./icons.js";

const MENU_MARGIN = 6;

// Keep an absolutely positioned popup inside the viewport.
function clamp(el, x, y) {
  const { innerWidth, innerHeight } = window;
  const rect = el.getBoundingClientRect();
  el.style.left = `${Math.max(MENU_MARGIN, Math.min(x, innerWidth - rect.width - MENU_MARGIN))}px`;
  el.style.top = `${Math.max(MENU_MARGIN, Math.min(y, innerHeight - rect.height - MENU_MARGIN))}px`;
}

let openMenuClose = null;

// Show a menu at (x, y). items: [{label, onSelect, danger, disabled} | {separator: true}].
// One menu at a time; opening another closes the first. Returns a function that closes it.
export function openMenu(items, { x, y, restoreFocus } = {}) {
  if (openMenuClose) openMenuClose();
  const menu = document.createElement("div");
  menu.className = "px-menu";
  menu.setAttribute("role", "menu");
  const buttons = [];
  for (const item of items) {
    if (item.separator) {
      const hr = document.createElement("div");
      hr.className = "px-menu-sep";
      hr.setAttribute("role", "separator");
      menu.append(hr);
      continue;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-menu-item" + (item.danger ? " danger" : "");
    btn.setAttribute("role", "menuitem");
    btn.tabIndex = -1;
    btn.textContent = item.label;
    btn.disabled = Boolean(item.disabled);
    btn.addEventListener("click", () => {
      close();
      item.onSelect();
    });
    menu.append(btn);
    buttons.push(btn);
  }
  document.body.append(menu);
  clamp(menu, x, y);

  const enabled = () => buttons.filter((b) => !b.disabled);
  function focusAt(step, from) {
    const list = enabled();
    if (!list.length) return;
    const at = list.indexOf(from);
    const next = at === -1 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
    list[next].focus();
  }

  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      if (restoreFocus) restoreFocus.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(event.key === "ArrowDown" ? 1 : -1, document.activeElement);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusAt(event.key === "Home" ? 1 : -1, null);
    } else if (event.key === "Tab") {
      close();
    }
  }
  function onPointer(event) {
    if (!menu.contains(event.target)) close();
  }
  function close() {
    if (!menu.isConnected) return;
    menu.remove();
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("mousedown", onPointer, true);
    document.removeEventListener("contextmenu", onPointer, true);
    window.removeEventListener("blur", close);
    window.removeEventListener("resize", close);
    if (openMenuClose === close) openMenuClose = null;
  }
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("mousedown", onPointer, true);
  document.addEventListener("contextmenu", onPointer, true);
  window.addEventListener("blur", close);
  window.addEventListener("resize", close);
  openMenuClose = close;
  const first = enabled()[0];
  if (first) first.focus();
  return close;
}

// A modal card over a dimmed page. Returns {card, body, close}; onClose runs once when it goes.
// Escape closes it; so does a click on the backdrop. Focus returns to where it was.
function openDialog({ title, label, wide = false, onClose } = {}) {
  if (openMenuClose) openMenuClose();
  const previous = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "px-backdrop";
  const card = document.createElement("div");
  card.className = "px-dialog" + (wide ? " wide" : "");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  if (label) card.setAttribute("aria-label", label);
  if (title) {
    const h = document.createElement("h2");
    h.className = "px-dialog-title";
    h.textContent = title;
    card.append(h);
    if (!label) {
      h.id = `px-dialog-title-${Date.now().toString(36)}`;
      card.setAttribute("aria-labelledby", h.id);
    }
  }
  const body = document.createElement("div");
  body.className = "px-dialog-body";
  card.append(body);
  backdrop.append(card);
  document.body.append(backdrop);

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener("keydown", onKey, true);
    if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus();
    if (onClose) onClose(result);
  }
  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(undefined);
    }
  }
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close(undefined);
  });
  return { card, body, close };
}

// A row of buttons at the foot of a dialog. buttons: [{label, onClick, primary, danger, id}].
function actions(...buttons) {
  const row = document.createElement("div");
  row.className = "px-dialog-actions";
  const made = {};
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : "");
    btn.textContent = b.label;
    btn.addEventListener("click", b.onClick);
    row.append(btn);
    if (b.id) made[b.id] = btn;
  }
  return { row, buttons: made };
}

function message(text, className = "px-dialog-text") {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

// Ask before something that cannot be undone. Resolves true on confirm, false otherwise.
export function confirmDialog({ title, text, confirmLabel = "OK", danger = false }) {
  return new Promise((resolve) => {
    const dialog = openDialog({ title, onClose: (ok) => resolve(ok === true) });
    dialog.body.append(message(text));
    const { row, buttons } = actions(
      { id: "ok", label: confirmLabel, primary: !danger, danger, onClick: () => dialog.close(true) },
      { label: "Cancel", onClick: () => dialog.close(false) },
    );
    dialog.body.append(row);
    buttons.ok.focus();
  });
}

// Pick a destination folder from the open folder's tree. nodes: the tree from /api/tree;
// exclude: a path whose subtree is not offered (a folder cannot move into itself); current:
// the folder the item is in now (shown but disabled). Resolves to the folder path ('' for the
// open folder itself) or null when cancelled.
export function pickFolder(nodes, { title = "Move to", rootName = "Folder", exclude = null, current = null } = {}) {
  return new Promise((resolve) => {
    let chosen = null;
    const dialog = openDialog({ title, onClose: (path) => resolve(typeof path === "string" ? path : null) });
    const list = document.createElement("div");
    list.className = "px-list";
    list.setAttribute("role", "listbox");
    const rows = [];

    function row(name, path, depth, disabled) {
      const el = document.createElement("div");
      el.className = "px-row";
      el.setAttribute("role", "option");
      el.dataset.path = path;
      el.style.setProperty("--depth", String(depth));
      el.tabIndex = -1;
      const ic = document.createElement("span");
      ic.className = "px-row-icon";
      ic.innerHTML = icons.folder;
      const label = document.createElement("span");
      label.className = "px-row-label";
      label.textContent = name;
      el.append(ic, label);
      if (disabled) {
        el.classList.add("disabled");
        el.setAttribute("aria-disabled", "true");
        el.title = "Already here";
      } else {
        el.addEventListener("click", () => select(el));
        el.addEventListener("dblclick", () => dialog.close(path));
      }
      rows.push(el);
      list.append(el);
    }
    function select(el) {
      for (const r of rows) {
        const on = r === el;
        r.classList.toggle("selected", on);
        r.setAttribute("aria-selected", on ? "true" : "false");
      }
      chosen = el.dataset.path;
      moveBtn.disabled = false;
      el.focus();
    }
    function walk(children, depth) {
      for (const node of children || []) {
        if (node.type !== "folder") continue;
        if (exclude !== null && (node.path === exclude || node.path.startsWith(exclude + "/"))) continue;
        row(node.name, node.path, depth, node.path === current);
        walk(node.children, depth + 1);
      }
    }
    row(rootName, "", 0, current === "");
    walk(nodes, 1);

    list.addEventListener("keydown", (event) => {
      const usable = rows.filter((r) => !r.classList.contains("disabled"));
      const at = usable.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = usable[Math.max(0, Math.min(usable.length - 1, at + step))];
        if (next) select(next);
      } else if (event.key === "Enter" && chosen !== null) {
        event.preventDefault();
        dialog.close(chosen);
      }
    });

    dialog.body.append(list);
    const { row: rowEl, buttons } = actions(
      { id: "move", label: "Move", primary: true, onClick: () => chosen !== null && dialog.close(chosen) },
      { label: "Cancel", onClick: () => dialog.close(null) },
    );
    const moveBtn = buttons.move;
    moveBtn.disabled = true;
    dialog.body.append(rowEl);
    const first = rows.find((r) => !r.classList.contains("disabled"));
    if (first) {
      first.tabIndex = 0;
      first.focus();
    }
  });
}

// Browse the machine for a folder to open. listFolders(path) fetches /api/folders and
// resolves to {path, parent, folders}. start: where to begin ('' for the home folder).
// Resolves to the chosen absolute path or null.
export function pickSystemFolder(listFolders, { start = "", title = "Open folder" } = {}) {
  return new Promise((resolve) => {
    const dialog = openDialog({ title, wide: true, onClose: (path) => resolve(typeof path === "string" ? path : null) });
    let here = null; // the listing on screen
    let seq = 0;

    const bar = document.createElement("div");
    bar.className = "px-picker-bar";
    const up = document.createElement("button");
    up.type = "button";
    up.className = "icon-btn";
    up.title = "Up";
    up.setAttribute("aria-label", "Up one folder");
    up.innerHTML = icons.arrowUp;
    const crumbs = document.createElement("nav");
    crumbs.className = "px-crumbs";
    crumbs.setAttribute("aria-label", "Folder path");
    bar.append(up, crumbs);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "px-input";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Folder path");
    input.placeholder = "Type a folder path";

    const list = document.createElement("div");
    list.className = "px-list tall";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Subfolders");

    const note = message("", "px-dialog-hint");

    const { row, buttons } = actions(
      { id: "open", label: "Open", primary: true, onClick: () => submit(input.value.trim() || (here && here.path)) },
      { label: "Cancel", onClick: () => dialog.close(null) },
    );

    dialog.body.append(bar, input, list, note, row);

    function setNote(text, error = false) {
      note.textContent = text;
      note.classList.toggle("is-error", error);
    }

    // One crumb per segment, each leading to the folder up to there. A Windows drive is a
    // crumb of its own ('C:\', never a bare 'C:', which would mean the current directory);
    // elsewhere the first crumb is '/'.
    function drawCrumbs(fullPath) {
      crumbs.replaceChildren();
      const windows = /^[a-zA-Z]:/.test(fullPath);
      const sep = windows ? "\\" : "/";
      const parts = fullPath.split(/[\\/]+/).filter(Boolean);
      if (!windows) parts.unshift("/");
      let acc = "";
      parts.forEach((part, i) => {
        if (i === 0) acc = windows ? part + sep : "/";
        else acc = acc.endsWith(sep) ? acc + part : acc + sep + part;
        const target = acc;
        if (i > 0) {
          const s = document.createElement("span");
          s.className = "px-crumb-sep";
          s.textContent = "›";
          crumbs.append(s);
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "px-crumb";
        b.textContent = part;
        b.title = target;
        if (i === parts.length - 1) b.setAttribute("aria-current", "location");
        b.addEventListener("click", () => go(target));
        crumbs.append(b);
      });
      crumbs.scrollLeft = crumbs.scrollWidth;
    }

    function draw() {
      drawCrumbs(here.path);
      input.value = here.path;
      up.disabled = !here.parent;
      list.replaceChildren();
      if (!here.folders.length) {
        list.append(message("No subfolders", "px-list-empty"));
      }
      for (const f of here.folders) {
        const el = document.createElement("div");
        el.className = "px-row";
        el.setAttribute("role", "option");
        el.tabIndex = -1;
        el.title = f.path;
        const ic = document.createElement("span");
        ic.className = "px-row-icon";
        ic.innerHTML = icons.folder;
        const label = document.createElement("span");
        label.className = "px-row-label";
        label.textContent = f.name;
        el.append(ic, label);
        el.addEventListener("click", () => go(f.path));
        el.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            go(f.path);
          }
        });
        list.append(el);
      }
      const first = list.querySelector(".px-row");
      if (first) first.tabIndex = 0;
    }

    async function go(path) {
      const mine = ++seq;
      setNote("Loading…");
      try {
        const reply = await listFolders(path);
        if (mine !== seq) return;
        here = reply;
        draw();
        setNote("");
      } catch (err) {
        if (mine !== seq) return;
        setNote(err && err.message ? err.message : "Could not open that folder", true);
      }
    }

    function submit(path) {
      if (!path) return;
      dialog.close(path);
    }

    up.addEventListener("click", () => here && here.parent && go(here.parent));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const typed = input.value.trim();
        if (!typed) return;
        if (here && typed === here.path) submit(typed);
        else go(typed);
      }
    });
    list.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const rows = Array.from(list.querySelectorAll(".px-row"));
      const at = rows.indexOf(document.activeElement);
      const next = rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))];
      if (next) next.focus();
    });

    go(start);
    input.focus();
  });
}
