// The folder tree in the explorer. Draws the nested nodes from /api/tree as a role="tree"
// with roving tabindex, chevrons on folders, and the open note marked active.
// Which folders are expanded and which note is open come in from the caller. The tree also
// hosts two inline inputs: renaming an item in place and naming a new folder.
import { icons } from "./icons.js";

// options: { expanded: Set<string>, activePath, showExtensions, onOpen(path), onToggle(path, open),
//            onContextMenu(node, event), onRename(path, name), onCreateFolder(parent, name) }
// showExtensions: true keeps '.md' on file names; the default hides it.
export function createTree(container, options) {
  let nodes = [];
  let byPath = new Map(); // path -> node, for anything that needs a node's type or name
  let focusedPath = null; // roving tabindex only: where the keyboard would land next
  let selectedPath = null; // the item the user chose (click, Enter, right-click, or an action)
  let renaming = null; // path of the item whose name is being edited
  let creating = null; // {parent} while a new folder is being named

  function isOpen(path) {
    return options.expanded.has(path);
  }

  // The name as the tree shows it: a note loses its .md unless extensions are switched on.
  function labelFor(node) {
    if (node.type === "file" && !options.showExtensions) return node.name.replace(/\.md$/i, "");
    return node.name;
  }

  function itemFor(path) {
    return container.querySelector(`.tree-item[data-path="${CSS.escape(path)}"]`);
  }

  function visibleItems() {
    return Array.from(container.querySelectorAll(".tree-item:not(.tree-inline)"));
  }

  function focusItem(el) {
    if (!el) return;
    for (const other of visibleItems()) other.tabIndex = -1;
    el.tabIndex = 0;
    focusedPath = el.dataset.path;
    el.focus();
  }

  // An inline text box. Enter commits, Escape cancels, leaving the box commits when the text
  // changed and cancels otherwise. Each outcome fires once.
  function inlineInput(initial, { onCommit, onCancel }) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tree-input";
    input.value = initial;
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Name");
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      if (commit && value && value !== initial) onCommit(value);
      else onCancel();
    };
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
    return input;
  }

  function inlineItem(depth, iconMarkup, input) {
    const item = document.createElement("div");
    item.className = "tree-item tree-inline";
    item.style.setProperty("--depth", String(depth));
    const ic = document.createElement("span");
    ic.className = "tree-file-icon";
    ic.innerHTML = iconMarkup;
    item.append(ic, input);
    return item;
  }

  function buildLevel(children, depth, parent) {
    const group = document.createElement("div");
    group.setAttribute("role", depth === 0 ? "presentation" : "group");
    group.className = "tree-group";

    if (creating && creating.parent === parent) {
      const input = inlineInput("", {
        onCommit: (name) => {
          creating = null;
          options.onCreateFolder(parent, name);
        },
        onCancel: () => {
          creating = null;
          render();
          focusItem(parent ? itemFor(parent) : visibleItems()[0]);
        },
      });
      group.append(inlineItem(depth, icons.folder, input));
    }

    for (const node of children) {
      const item = document.createElement("div");
      item.className = `tree-item ${node.type}`;
      item.dataset.path = node.path;
      item.setAttribute("role", "treeitem");
      item.setAttribute("aria-level", String(depth + 1));
      item.style.setProperty("--depth", String(depth));
      item.tabIndex = -1;
      item.title = node.name;

      if (node.path === selectedPath) {
        item.classList.add("selected");
        item.setAttribute("aria-selected", "true");
      }

      if (node.type === "folder") {
        const open = isOpen(node.path);
        item.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) item.classList.add("open");
        const chevron = document.createElement("span");
        chevron.className = "tree-chevron";
        chevron.innerHTML = icons.chevronRight;
        item.append(chevron);
      } else {
        const bullet = document.createElement("span");
        bullet.className = "tree-file-icon";
        bullet.innerHTML = icons.file;
        item.append(bullet);
        if (node.path === options.activePath) {
          item.classList.add("active");
          item.setAttribute("aria-current", "true");
        }
      }
      if (renaming === node.path) {
        item.classList.add("renaming");
        const input = inlineInput(labelFor(node), {
          onCommit: (name) => {
            renaming = null;
            options.onRename(node.path, name);
          },
          onCancel: () => {
            renaming = null;
            render();
            focusItem(itemFor(node.path));
          },
        });
        item.append(input);
      } else {
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = labelFor(node);
        item.append(label);
      }
      group.append(item);

      const namingInside = Boolean(creating && creating.parent === node.path);
      const hasChildren = Boolean(node.children && node.children.length);
      if (node.type === "folder" && isOpen(node.path) && (namingInside || hasChildren)) {
        group.append(buildLevel(node.children || [], depth + 1, node.path));
      }
    }
    return group;
  }

  function render() {
    container.replaceChildren(buildLevel(nodes, 0, ""));
    if (!nodes.length && !creating) {
      const empty = document.createElement("p");
      empty.className = "tree-empty";
      empty.textContent = "No notes in this folder yet";
      container.append(empty);
      return;
    }
    // Roving tabindex: the focused item, else the active note, else the first item.
    const first = (focusedPath && itemFor(focusedPath)) || (options.activePath && itemFor(options.activePath)) || visibleItems()[0];
    if (first) {
      first.tabIndex = 0;
      focusedPath = first.dataset.path;
    }
    const input = container.querySelector(".tree-input");
    if (input) {
      input.focus();
      input.select();
      input.scrollIntoView({ block: "nearest" });
    }
  }

  function index(children, out) {
    for (const node of children || []) {
      out.set(node.path, node);
      if (node.type === "folder") index(node.children, out);
    }
    return out;
  }

  function toggle(path, open) {
    options.onToggle(path, open);
    render();
    focusItem(itemFor(path));
  }

  // Mark path as the chosen item. Only a click, a keyboard activation, a right-click or an
  // action that made or renamed an item does this; arrow keys and the roving tabindex do not.
  function select(path) {
    if (selectedPath === path) return;
    const before = selectedPath && itemFor(selectedPath);
    if (before) {
      before.classList.remove("selected");
      before.removeAttribute("aria-selected");
    }
    selectedPath = path;
    const after = path && itemFor(path);
    if (after) {
      after.classList.add("selected");
      after.setAttribute("aria-selected", "true");
    }
  }

  function activate(item) {
    select(item.dataset.path);
    if (item.classList.contains("folder")) toggle(item.dataset.path, !isOpen(item.dataset.path));
    else options.onOpen(item.dataset.path);
  }

  function parentPath(path) {
    const i = path.lastIndexOf("/");
    return i === -1 ? null : path.slice(0, i);
  }

  container.addEventListener("click", (event) => {
    if (event.target.closest(".tree-input")) return;
    const item = event.target.closest(".tree-item");
    if (!item || !container.contains(item) || item.classList.contains("tree-inline")) return;
    if (item.classList.contains("renaming")) return;
    focusedPath = item.dataset.path;
    activate(item);
  });

  container.addEventListener("contextmenu", (event) => {
    if (!options.onContextMenu) return;
    if (event.target.closest(".tree-input")) return;
    const item = event.target.closest(".tree-item");
    if (!item || item.classList.contains("tree-inline")) return;
    event.preventDefault();
    const node = byPath.get(item.dataset.path);
    if (!node) return;
    focusedPath = node.path;
    for (const other of visibleItems()) other.tabIndex = -1;
    item.tabIndex = 0;
    select(node.path);
    options.onContextMenu(node, event);
  });

  container.addEventListener("keydown", (event) => {
    if (event.target.closest(".tree-input")) return;
    const item = event.target.closest(".tree-item");
    if (!item || item.classList.contains("tree-inline")) return;
    const items = visibleItems();
    const at = items.indexOf(item);
    const path = item.dataset.path;
    const folder = item.classList.contains("folder");
    switch (event.key) {
      case "ArrowDown":
        focusItem(items[Math.min(items.length - 1, at + 1)]);
        break;
      case "ArrowUp":
        focusItem(items[Math.max(0, at - 1)]);
        break;
      case "ArrowRight":
        if (folder && !isOpen(path)) toggle(path, true);
        else if (folder) focusItem(items[at + 1]);
        break;
      case "ArrowLeft":
        if (folder && isOpen(path)) toggle(path, false);
        else if (parentPath(path)) focusItem(itemFor(parentPath(path)));
        break;
      case "Home":
        focusItem(items[0]);
        break;
      case "End":
        focusItem(items[items.length - 1]);
        break;
      case "Enter":
      case " ":
        activate(item);
        break;
      case "F2":
        if (options.onRename) startRename(path);
        break;
      case "ContextMenu":
        if (options.onContextMenu && byPath.get(path)) {
          const rect = item.getBoundingClientRect();
          options.onContextMenu(byPath.get(path), { clientX: rect.left + 24, clientY: rect.bottom, target: item });
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  function startRename(path) {
    if (!byPath.has(path)) return;
    creating = null;
    renaming = path;
    render();
  }

  return {
    setNodes(next) {
      nodes = Array.isArray(next) ? next : [];
      byPath = index(nodes, new Map());
      if (renaming && !byPath.has(renaming)) renaming = null;
      if (selectedPath && !byPath.has(selectedPath)) selectedPath = null;
      render();
    },
    render,
    // Scroll the open note into view, for when it was opened from elsewhere.
    reveal(path) {
      const el = itemFor(path);
      if (el) el.scrollIntoView({ block: "nearest" });
    },
    // The node the user chose (clicked, activated, right-clicked, or just made), or null when
    // nothing is selected. Keyboard focus alone does not count.
    selected() {
      return (selectedPath && byPath.get(selectedPath)) || null;
    },
    // Choose an item without moving focus, or clear the choice with null.
    select,
    node(path) {
      return byPath.get(path) || null;
    },
    // Replace the name of path with a text box; Enter reports the new name through onRename.
    startRename,
    // Show a name box for a new folder inside parent ('' for the top level); the caller has
    // already made sure parent is expanded.
    startNewFolder(parent) {
      renaming = null;
      creating = { parent };
      render();
    },
    // Select an item and move keyboard focus to it, for after an action made or renamed it.
    focus(path) {
      const el = itemFor(path);
      if (!el) return;
      select(path);
      focusItem(el);
    },
  };
}
