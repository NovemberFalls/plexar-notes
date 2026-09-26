// The folder tree in the explorer. Draws the nested nodes from /api/tree as a role="tree"
// with roving tabindex, chevrons on folders, and the open note marked active.
// Which folders are expanded and which note is open come in from the caller.
import { icons } from "./icons.js";

// options: { expanded: Set<string>, activePath, onOpen(path), onToggle(path, open) }
export function createTree(container, options) {
  let nodes = [];
  let focusedPath = null;

  function isOpen(path) {
    return options.expanded.has(path);
  }

  function itemFor(path) {
    return container.querySelector(`.tree-item[data-path="${CSS.escape(path)}"]`);
  }

  function visibleItems() {
    return Array.from(container.querySelectorAll(".tree-item"));
  }

  function focusItem(el) {
    if (!el) return;
    for (const other of visibleItems()) other.tabIndex = -1;
    el.tabIndex = 0;
    focusedPath = el.dataset.path;
    el.focus();
  }

  function buildLevel(children, depth) {
    const group = document.createElement("div");
    group.setAttribute("role", depth === 0 ? "presentation" : "group");
    group.className = "tree-group";
    for (const node of children) {
      const item = document.createElement("div");
      item.className = `tree-item ${node.type}`;
      item.dataset.path = node.path;
      item.setAttribute("role", "treeitem");
      item.setAttribute("aria-level", String(depth + 1));
      item.style.setProperty("--depth", String(depth));
      item.tabIndex = -1;
      item.title = node.name;

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
      const label = document.createElement("span");
      label.className = "tree-label";
      label.textContent = node.name;
      item.append(label);
      group.append(item);

      if (node.type === "folder" && isOpen(node.path) && node.children && node.children.length) {
        group.append(buildLevel(node.children, depth + 1));
      }
    }
    return group;
  }

  function render() {
    container.replaceChildren(buildLevel(nodes, 0));
    if (!nodes.length) {
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
  }

  function toggle(path, open) {
    options.onToggle(path, open);
    render();
    focusItem(itemFor(path));
  }

  function activate(item) {
    if (item.classList.contains("folder")) toggle(item.dataset.path, !isOpen(item.dataset.path));
    else options.onOpen(item.dataset.path);
  }

  function parentPath(path) {
    const i = path.lastIndexOf("/");
    return i === -1 ? null : path.slice(0, i);
  }

  container.addEventListener("click", (event) => {
    const item = event.target.closest(".tree-item");
    if (!item || !container.contains(item)) return;
    focusedPath = item.dataset.path;
    activate(item);
  });

  container.addEventListener("keydown", (event) => {
    const item = event.target.closest(".tree-item");
    if (!item) return;
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
      default:
        return;
    }
    event.preventDefault();
  });

  return {
    setNodes(next) {
      nodes = Array.isArray(next) ? next : [];
      render();
    },
    render,
    // Scroll the open note into view, for when it was opened from elsewhere.
    reveal(path) {
      const el = itemFor(path);
      if (el) el.scrollIntoView({ block: "nearest" });
    },
  };
}
