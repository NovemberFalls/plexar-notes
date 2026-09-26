const test = require("node:test");
const assert = require("node:assert");
const { addNote, removeNote } = require("../notes.js");

test("addNote appends a trimmed note with the next id", () => {
  const a = addNote([], "  first  ", 1);
  assert.deepStrictEqual(a, [{ id: 1, text: "first", created: 1 }]);
  assert.strictEqual(addNote(a, "second", 2)[1].id, 2);
});

test("addNote ignores empty text", () => {
  assert.deepStrictEqual(addNote([], "   "), []);
});

test("removeNote drops only that id", () => {
  const a = addNote(addNote([], "a", 1), "b", 2);
  assert.deepStrictEqual(removeNote(a, 1).map(n => n.text), ["b"]);
});
