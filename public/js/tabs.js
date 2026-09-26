// The tab bar: one tab per open note (or an empty 'New tab'), a close button on each, a +
// button at the end. The pure helpers below work on the tabs array from state.js; the
// renderer only draws and forwards clicks.
import { icons } from "./icons.js";

let seq = 0;
function nextId(tabs) {
  let id;
  do id = `t${(++seq).toString(36)}${Date.now().toString(36)}`;
  while (tabs.some((t) => t.id === id));
  return id;
}

export function tabTitle(tab) {
  if (!tab || !tab.path) return "New tab";
  const last = tab.path.split("/").pop() || tab.path;
  return last.replace(/\.md$/i, "");
}

// Open a path: reuse its tab if one exists, take over an empty active tab, or add a tab
// after the active one. Returns {tabs, activeTab}.
export function openInTabs(tabs, activeTab, path) {
  const existing = tabs.find((t) => t.path === path);
  if (existing) return { tabs, activeTab: existing.id };
  const active = tabs.find((t) => t.id === activeTab);
  if (active && active.path === null) {
    return { tabs: tabs.map((t) => (t.id === active.id ? { ...t, path } : t)), activeTab: active.id };
  }
  const tab = { id: nextId(tabs), path };
  const at = active ? tabs.indexOf(active) + 1 : tabs.length;
  const next = tabs.slice();
  next.splice(at, 0, tab);
  return { tabs: next, activeTab: tab.id };
}

export function newTab(tabs) {
  const tab = { id: nextId(tabs), path: null };
  return { tabs: [...tabs, tab], activeTab: tab.id };
}

// Close a tab; when it was active the neighbour to the right (else left) takes over.
export function closeInTabs(tabs, activeTab, id) {
  const at = tabs.findIndex((t) => t.id === id);
  if (at === -1) return { tabs, activeTab };
  const next = tabs.filter((t) => t.id !== id);
  let nextActive = activeTab;
  if (activeTab === id) {
    const neighbour = next[at] || next[at - 1] || null;
    nextActive = neighbour ? neighbour.id : null;
  }
  return { tabs: next, activeTab: nextActive };
}

// The id of the tab `step` positions away (wrapping), for Ctrl+Tab and Ctrl+Shift+Tab.
export function cycleTabs(tabs, activeTab, step = 1) {
  if (!tabs.length) return null;
  const at = Math.max(0, tabs.findIndex((t) => t.id === activeTab));
  return tabs[(at + step + tabs.length) % tabs.length].id;
}

// Draw the tab bar into container and route clicks to the handlers:
// onSelect(id), onClose(id), onNew().
export function createTabBar(container, handlers) {
  container.addEventListener("click", (event) => {
    const closeBtn = event.target.closest(".tab-close");
    if (closeBtn) {
      event.stopPropagation();
      handlers.onClose(closeBtn.closest(".tab").dataset.id);
      return;
    }
    if (event.target.closest(".tab-new")) {
      handlers.onNew();
      return;
    }
    const tab = event.target.closest(".tab");
    if (tab) handlers.onSelect(tab.dataset.id);
  });

  // Middle click closes a tab.
  container.addEventListener("auxclick", (event) => {
    if (event.button !== 1) return;
    const tab = event.target.closest(".tab");
    if (!tab) return;
    event.preventDefault();
    handlers.onClose(tab.dataset.id);
  });
  // Stop the browser's autoscroll on middle button down inside the bar.
  container.addEventListener("mousedown", (event) => {
    if (event.button === 1 && event.target.closest(".tab")) event.preventDefault();
  });

  return {
    render(tabs, activeTab) {
      const frag = document.createDocumentFragment();
      const strip = document.createElement("div");
      strip.className = "tab-strip";
      strip.setAttribute("role", "tablist");
      for (const tab of tabs) {
        const el = document.createElement("div");
        el.className = "tab" + (tab.id === activeTab ? " active" : "");
        el.dataset.id = tab.id;
        el.setAttribute("role", "tab");
        el.setAttribute("aria-selected", tab.id === activeTab ? "true" : "false");
        el.tabIndex = tab.id === activeTab ? 0 : -1;
        el.title = tab.path || "New tab";
        const label = document.createElement("span");
        label.className = "tab-title";
        label.textContent = tabTitle(tab);
        const close = document.createElement("button");
        close.type = "button";
        close.className = "icon-btn tab-close";
        close.setAttribute("aria-label", `Close ${tabTitle(tab)}`);
        close.title = "Close";
        close.innerHTML = icons.close;
        el.append(label, close);
        strip.append(el);
      }
      const add = document.createElement("button");
      add.type = "button";
      add.className = "icon-btn tab-new";
      add.setAttribute("aria-label", "New tab");
      add.title = "New tab";
      add.innerHTML = icons.plus;
      frag.append(strip, add);
      container.replaceChildren(frag);
      const active = strip.querySelector(".tab.active");
      if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
  };
}
