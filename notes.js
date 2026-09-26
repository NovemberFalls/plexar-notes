// Plexar Notes: the note logic, kept free of the DOM so `node --test` can check it.
// A note is {id, text, created}. Every function returns a new list; none mutates its input.

function addNote(notes, text, now = Date.now()) {
  const t = String(text || "").trim();
  if (!t) return notes;
  const id = notes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  return [...notes, { id, text: t, created: now }];
}

function removeNote(notes, id) {
  return notes.filter(n => n.id !== id);
}

if (typeof module !== "undefined") module.exports = { addNote, removeNote };
