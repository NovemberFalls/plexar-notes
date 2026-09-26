// Backlinks for the note on screen: the 'Backlinks: N' button in the status bar and the
// 'Linked mentions' panel it opens, listing every note that links here with the line the link
// sits on. The count comes from GET /api/backlinks. Text is only ever set through textContent.

const LINK = /\[\[[^\[\]]*\]\]/g;

// The context line with each [[link]] wrapped in a <b> so it can take the accent.
function appendContext(el, text) {
  let last = 0;
  for (const m of String(text || "").matchAll(LINK)) {
    if (m.index > last) el.append(document.createTextNode(text.slice(last, m.index)));
    const b = document.createElement("b");
    b.className = "backlink-link";
    b.textContent = m[0];
    el.append(b);
    last = m.index + m[0].length;
  }
  if (last < text.length) el.append(document.createTextNode(text.slice(last)));
}

// button: the status bar button; panel: the <aside id="backlinks">.
// handlers.onOpen(path) opens a source note. handlers.fetch(path) resolves to the API reply
// ({count, backlinks}) so the caller keeps its own error handling.
export function createBacklinks(button, panel, handlers) {
  let path = null; // the note the count is for
  let items = [];
  let seq = 0; // the newest request; older replies are dropped

  function label(count) {
    button.textContent = `Backlinks: ${count}`;
  }

  function isOpen() {
    return !panel.hidden;
  }

  function render() {
    const frag = document.createDocumentFragment();
    const head = document.createElement("h2");
    head.className = "backlinks-title";
    head.textContent = "Linked mentions";
    frag.append(head);
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "backlinks-empty";
      empty.textContent = "No notes link here yet";
      frag.append(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "backlinks-list";
      for (const item of items) {
        const li = document.createElement("li");
        li.className = "backlink";
        const open = document.createElement("button");
        open.type = "button";
        open.className = "backlink-title";
        open.textContent = item.title;
        open.title = item.from;
        open.dataset.path = item.from;
        const context = document.createElement("div");
        context.className = "backlink-context";
        appendContext(context, item.context);
        li.append(open, context);
        list.append(li);
      }
      frag.append(list);
    }
    panel.replaceChildren(frag);
  }

  function open() {
    panel.hidden = false;
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("aria-expanded", "true");
    render();
  }

  function close() {
    if (!isOpen()) return;
    panel.hidden = true;
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  // Ask the server again for the note at next (null when no note is on screen).
  async function refresh(next) {
    path = next;
    const mine = ++seq;
    if (!path) {
      items = [];
      label(0);
      if (isOpen()) render();
      return;
    }
    let reply;
    try {
      reply = await handlers.fetch(path);
    } catch (err) {
      console.error("Plexar Notes: could not load backlinks", err);
      return;
    }
    if (mine !== seq) return;
    items = Array.isArray(reply.backlinks) ? reply.backlinks : [];
    label(Number.isInteger(reply.count) ? reply.count : items.length);
    if (isOpen()) render();
  }

  button.addEventListener("click", toggle);
  panel.addEventListener("click", (event) => {
    const link = event.target.closest(".backlink-title");
    if (link && panel.contains(link) && link.dataset.path) handlers.onOpen(link.dataset.path);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented || !isOpen()) return;
    event.preventDefault();
    close();
    button.focus();
  });

  return { refresh, open, close, toggle, isOpen };
}
