// The search box in the title bar: what is typed goes to /api/search after a short pause and
// the results drop down under the box. Two modes share the one endpoint: 'file' (Ctrl+P) is
// for opening a note by name and hides the snippets; 'text' (Ctrl+Shift+F) shows them.
// Text is only ever set through textContent, so result text is never parsed as markup.
import { highlight } from "/lib/search.js";

const DEBOUNCE_MS = 150;
const LIMIT = 20;
const SNIPPETS_MAX = 2;
const PLACEHOLDERS = { file: "Open file", text: "Search in files" };

function folderOf(path) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

// Append text to el with the query hits wrapped in <b>, built from highlight() segments.
function appendHighlighted(el, text, query) {
  for (const seg of highlight(text, query)) {
    if (seg.hit) {
      const b = document.createElement("b");
      b.className = "search-hit";
      b.textContent = seg.text;
      el.append(b);
    } else {
      el.append(document.createTextNode(seg.text));
    }
  }
}

// input: the <input id="search">; listbox: the <div id="search-results" role="listbox">.
// handlers.onOpen(path, match, query) is called with the chosen result's path, its first
// content match ({line, text}) or null, and the query it came from.
export function createSearch(input, listbox, handlers) {
  let mode = "text";
  let timer = null;
  let seq = 0; // the newest request; older replies are dropped
  let query = "";
  let results = [];
  let selected = -1;

  function setMode(next) {
    if (!PLACEHOLDERS[next]) return;
    mode = next;
    input.placeholder = PLACEHOLDERS[next];
    if (!listbox.hidden) render();
  }

  function focus(next) {
    if (next) setMode(next);
    input.focus();
    input.select();
    if (input.value.trim()) schedule(0);
  }

  function close() {
    listbox.hidden = true;
    listbox.replaceChildren();
    results = [];
    selected = -1;
    input.removeAttribute("aria-activedescendant");
    input.setAttribute("aria-expanded", "false");
  }

  function clear() {
    input.value = "";
    seq += 1;
    clearTimeout(timer);
    close();
  }

  function showMessage(text) {
    const p = document.createElement("div");
    p.className = "search-empty";
    p.textContent = text;
    listbox.replaceChildren(p);
    listbox.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function applySelection() {
    const items = listbox.querySelectorAll(".search-item");
    items.forEach((item, i) => {
      const on = i === selected;
      item.classList.toggle("selected", on);
      item.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        input.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView({ block: "nearest" });
      }
    });
    if (selected === -1) input.removeAttribute("aria-activedescendant");
  }

  function render() {
    if (results.length === 0) {
      showMessage("No results");
      return;
    }
    const frag = document.createDocumentFragment();
    results.forEach((r, i) => {
      const item = document.createElement("div");
      item.className = "search-item";
      item.id = `search-result-${i}`;
      item.dataset.index = String(i);
      item.setAttribute("role", "option");
      item.title = r.path;

      const title = document.createElement("div");
      title.className = "search-title";
      appendHighlighted(title, r.title, query);
      item.append(title);

      const folder = folderOf(r.path);
      if (folder) {
        const where = document.createElement("div");
        where.className = "search-path";
        appendHighlighted(where, folder, query);
        item.append(where);
      }

      if (mode === "text") {
        for (const m of (r.matches || []).slice(0, SNIPPETS_MAX)) {
          const line = document.createElement("div");
          line.className = "search-snippet";
          const num = document.createElement("span");
          num.className = "search-line";
          num.textContent = String(m.line);
          line.append(num);
          appendHighlighted(line, m.text, query);
          item.append(line);
        }
      }
      frag.append(item);
    });
    listbox.replaceChildren(frag);
    listbox.hidden = false;
    input.setAttribute("aria-expanded", "true");
    applySelection();
  }

  async function run() {
    const q = input.value.trim();
    const mine = ++seq;
    if (!q) {
      close();
      return;
    }
    let body;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${LIMIT}`);
      body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    } catch (err) {
      if (mine !== seq) return;
      console.error("Plexar Notes: search failed", err);
      showMessage("Search failed");
      return;
    }
    if (mine !== seq) return; // something newer was typed meanwhile
    if (!input.value.trim()) {
      close();
      return;
    }
    query = q;
    results = Array.isArray(body.results) ? body.results : [];
    selected = results.length ? 0 : -1;
    render();
  }

  function schedule(delay = DEBOUNCE_MS) {
    clearTimeout(timer);
    if (!input.value.trim()) {
      seq += 1;
      close();
      return;
    }
    timer = setTimeout(run, delay);
  }

  function open(index) {
    const r = results[index];
    if (!r) return;
    const match = r.matches && r.matches.length ? r.matches[0] : null;
    const q = query;
    clear();
    input.blur();
    handlers.onOpen(r.path, match, q);
  }

  function move(step) {
    if (results.length === 0) return;
    selected = (selected + step + results.length) % results.length;
    applySelection();
  }

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", listbox.id);
  input.setAttribute("aria-expanded", "false");

  input.addEventListener("input", () => schedule());
  input.addEventListener("focus", () => {
    if (input.value.trim() && listbox.hidden) schedule(0);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (listbox.hidden) {
        if (input.value.trim()) schedule(0);
        return;
      }
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      if (selected === -1) return;
      event.preventDefault();
      open(selected);
    } else if (event.key === "Escape") {
      event.preventDefault();
      clear();
      input.blur();
    }
  });

  // Mouse: hovering selects, clicking opens. mousedown is swallowed so the input keeps focus.
  listbox.addEventListener("mousedown", (event) => event.preventDefault());
  listbox.addEventListener("mousemove", (event) => {
    const item = event.target.closest(".search-item");
    if (!item) return;
    const index = Number(item.dataset.index);
    if (index !== selected) {
      selected = index;
      applySelection();
    }
  });
  listbox.addEventListener("click", (event) => {
    const item = event.target.closest(".search-item");
    if (item) open(Number(item.dataset.index));
  });

  // A click anywhere else closes the dropdown; the typed text stays for the next focus.
  document.addEventListener("mousedown", (event) => {
    if (listbox.hidden) return;
    if (input.contains(event.target) || listbox.contains(event.target)) return;
    close();
  });

  return { focus, setMode, close, clear, mode: () => mode };
}
