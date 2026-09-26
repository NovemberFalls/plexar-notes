// lib/autosave.js under a fake clock: the timers are injected, so the tests decide when time
// passes, and save() only records what it was asked to write.
const test = require("node:test");
const assert = require("node:assert");

const load = () => import("../lib/autosave.js");

// Let every promise chain started so far run to its end.
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

// A clock whose timers only fire when tick() moves it forward.
function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    async tick(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at);
        if (!due.length) break;
        const [id, t] = due[0];
        timers.delete(id);
        now = t.at;
        t.fn();
        await settle();
      }
      now = end;
    },
    armed() {
      return timers.size;
    },
  };
}

// An autosave over a fake clock and a recording save. save fails while fail() is truthy.
async function setup({ delay = 800 } = {}) {
  const { createAutosave } = await load();
  const clock = fakeClock();
  const saves = [];
  const states = [];
  let failing = false;
  const autosave = createAutosave({
    delay,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    save: async (path, content) => {
      saves.push([path, content]);
      if (failing) throw new Error("disk on fire");
    },
    onState: (state, path) => states.push(`${state} ${path}`),
  });
  return { autosave, clock, saves, states, fail: (on) => (failing = on) };
}

test("rapid changes coalesce into one save with the latest content", async () => {
  const { autosave, clock, saves, states } = await setup();
  autosave.change("a.md", "h");
  await clock.tick(500);
  autosave.change("a.md", "he");
  await clock.tick(500);
  autosave.change("a.md", "hello");
  assert.deepStrictEqual(saves, [], "nothing is written while the user is still typing");
  assert.strictEqual(autosave.pending(), true);
  await clock.tick(799);
  assert.deepStrictEqual(saves, []);
  await clock.tick(1);
  assert.deepStrictEqual(saves, [["a.md", "hello"]]);
  assert.deepStrictEqual(states, ["dirty a.md", "saving a.md", "saved a.md"]);
  assert.strictEqual(autosave.pending(), false);
  assert.strictEqual(clock.armed(), 0, "no timer is left behind");
});

test("the state goes dirty, saving, saved exactly once per write", async () => {
  const { autosave, clock, states } = await setup();
  autosave.change("n.md", "1");
  autosave.change("n.md", "12");
  autosave.change("n.md", "123");
  assert.deepStrictEqual(states, ["dirty n.md"]);
  await clock.tick(800);
  assert.deepStrictEqual(states, ["dirty n.md", "saving n.md", "saved n.md"]);
  autosave.change("n.md", "1234");
  assert.deepStrictEqual(states.slice(3), ["dirty n.md"]);
  await clock.tick(800);
  assert.deepStrictEqual(states.slice(3), ["dirty n.md", "saving n.md", "saved n.md"]);
});

test("a failed save reports error and keeps the content dirty for the next try", async () => {
  const { autosave, clock, saves, states, fail } = await setup();
  fail(true);
  autosave.change("a.md", "one");
  await clock.tick(800);
  assert.deepStrictEqual(saves, [["a.md", "one"]]);
  assert.deepStrictEqual(states, ["dirty a.md", "saving a.md", "error a.md"]);
  assert.strictEqual(autosave.pending(), true, "the failed content is still dirty");

  // The next change carries the still-dirty content forward and retries once the timer fires.
  fail(false);
  autosave.change("a.md", "one two");
  assert.deepStrictEqual(states.slice(3), ["dirty a.md"]);
  await clock.tick(800);
  assert.deepStrictEqual(saves, [
    ["a.md", "one"],
    ["a.md", "one two"],
  ]);
  assert.deepStrictEqual(states.slice(3), ["dirty a.md", "saving a.md", "saved a.md"]);
  assert.strictEqual(autosave.pending(), false);
});

test("flush() after an error retries without waiting for a change", async () => {
  const { autosave, clock, saves, fail } = await setup();
  fail(true);
  autosave.change("a.md", "x");
  await clock.tick(800);
  assert.strictEqual(saves.length, 1);
  fail(false);
  await autosave.flush();
  assert.deepStrictEqual(saves, [
    ["a.md", "x"],
    ["a.md", "x"],
  ]);
  assert.strictEqual(autosave.pending(), false);
});

test("flush() saves at once, cancels the timer and resolves when the write is done", async () => {
  const { autosave, clock, saves, states } = await setup();
  autosave.change("a.md", "draft");
  assert.strictEqual(clock.armed(), 1);
  await autosave.flush();
  assert.deepStrictEqual(saves, [["a.md", "draft"]]);
  assert.deepStrictEqual(states, ["dirty a.md", "saving a.md", "saved a.md"]);
  assert.strictEqual(clock.armed(), 0);
  await clock.tick(2000);
  assert.strictEqual(saves.length, 1, "the timer does not write a second time");
  await autosave.flush();
  assert.strictEqual(saves.length, 1, "a clean flush writes nothing");
});

test("a change to a different path flushes the previous one first", async () => {
  const { autosave, clock, saves, states } = await setup();
  autosave.change("a.md", "alpha");
  await clock.tick(100);
  autosave.change("b.md", "beta");
  await settle();
  assert.deepStrictEqual(saves, [["a.md", "alpha"]]);
  assert.deepStrictEqual(states, ["dirty a.md", "saving a.md", "dirty b.md", "saved a.md"]);
  assert.strictEqual(autosave.pending(), true, "b.md is still dirty");
  await clock.tick(800);
  assert.deepStrictEqual(saves, [
    ["a.md", "alpha"],
    ["b.md", "beta"],
  ]);
  assert.deepStrictEqual(states.slice(4), ["saving b.md", "saved b.md"]);
  assert.strictEqual(autosave.pending(), false);
});

test("dispose() cancels the pending save and ignores later changes", async () => {
  const { autosave, clock, saves } = await setup();
  autosave.change("a.md", "gone");
  assert.strictEqual(clock.armed(), 1);
  autosave.dispose();
  assert.strictEqual(clock.armed(), 0);
  assert.strictEqual(autosave.pending(), false);
  await clock.tick(5000);
  autosave.change("a.md", "still gone");
  await clock.tick(5000);
  await autosave.flush();
  assert.deepStrictEqual(saves, []);
});

test("the defaults use the global timers and a save function is required", async () => {
  const { createAutosave } = await load();
  assert.throws(() => createAutosave({}), TypeError);
  const saves = [];
  const autosave = createAutosave({ delay: 1, save: async (p, c) => saves.push([p, c]) });
  autosave.change("a.md", "real clock");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepStrictEqual(saves, [["a.md", "real clock"]]);
});
