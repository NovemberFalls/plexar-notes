// The 'Starred' panel in the explorer: one row per starred note with its name, the folder it
// sits in, and an × that unstars it. Which notes are starred lives in state.js; this module
// only draws a list of paths and forwards clicks. Text goes in through textContent only.
import { icons } from "./icons.js";

function folderOf(path) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function nameOf(path) {
  const last = path.split("/").pop() || path;
  return last.replace(/\.md$/i, "");
}

// container: the <div id="starred-list">. handlers.onOpen(path) opens a note;
// handlers.onRemove(path) unstars it.
export function createStarredPanel(container, handlers) {
  let activePath = null;

  function render(paths, active = activePath) {
    activePath = active;
    container.replaceChildren();
    if (!paths.length) {
      const empty = document.createElement("p");
      empty.className = "panel-hint";
      empty.textContent = "Star a note to keep it here.";
      container.append(empty);
      return;
    }
    for (const path of paths) {
      const row = document.createElement("div");
      row.className = "starred-item" + (path === activePath ? " active" : "");
      row.setAttribute("role", "listitem");
      row.dataset.path = path;

      const open = document.createElement("button");
      open.type = "button";
      open.className = "starred-open";
      open.dataset.path = path;
      const name = document.createElement("span");
      name.className = "starred-name";
      name.textContent = nameOf(path);
      open.append(name);
      const folder = folderOf(path);
      const where = document.createElement("span");
      where.className = "starred-path";
      where.textContent = folder || "Folder root";
      open.append(where);
      if (path === activePath) open.setAttribute("aria-current", "true");

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn starred-remove";
      remove.dataset.path = path;
      remove.setAttribute("aria-label", `Remove ${nameOf(path)} from starred`);
      remove.dataset.tip = "Remove";
      remove.innerHTML = icons.close;

      row.append(open, remove);
      container.append(row);
    }
  }

  container.addEventListener("click", (event) => {
    const remove = event.target.closest(".starred-remove");
    if (remove && container.contains(remove)) {
      handlers.onRemove(remove.dataset.path);
      return;
    }
    const open = event.target.closest(".starred-open");
    if (open && container.contains(open)) handlers.onOpen(open.dataset.path);
  });

  return { render };
}
