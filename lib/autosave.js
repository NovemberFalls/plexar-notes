// Debounced saving for Plexar Notes. Pure logic, no DOM: the timers and the save function
// are injected, so tests drive it with fake clocks and a recording save.
//
//   const autosave = createAutosave({ delay, save, onState });
//   autosave.change(path, content)   the latest content of a note; (re)starts the timer
//   autosave.flush()                 save now if anything is dirty; resolves when done
//   autosave.pending()               true while content is dirty or a save is running
//   autosave.setDelay(ms)            the wait after the last change; applies from the next change
//   autosave.dispose()               cancel the timer and ignore further changes
//
// onState(state, path) fires on each transition: 'dirty' when a change arrives, 'saving'
// when a write starts, 'saved' when it lands, 'error' when it fails. After an error the
// content stays dirty, so the next change or flush tries again. Only one path is tracked
// at a time: a change to a different path flushes the previous one first.

export function createAutosave({
  delay = 800,
  save,
  setTimeout: st = globalThis.setTimeout,
  clearTimeout: ct = globalThis.clearTimeout,
  onState,
} = {}) {
  if (typeof save !== "function") throw new TypeError("createAutosave needs a save(path, content) function");

  let path = null; // the path the latest change() was for
  let content = "";
  let dirty = false; // content differs from what was last handed to save()
  let timer = null;
  let disposed = false;
  let inFlight = 0;
  let queue = Promise.resolve(); // writes run one after another, never overlapping
  let last = { state: null, path: null };

  function emit(state, p) {
    if (last.state === state && last.path === p) return;
    last = { state, path: p };
    if (typeof onState === "function") onState(state, p);
  }

  function cancel() {
    if (timer === null) return;
    ct(timer);
    timer = null;
  }

  // Queue one write of c to p behind any write still running.
  function commit(p, c) {
    emit("saving", p);
    inFlight += 1;
    const job = queue
      .then(() => save(p, c))
      .then(
        () => {
          // A newer change for the same path arrived meanwhile: it is still dirty, not saved.
          if (!(dirty && path === p)) emit("saved", p);
        },
        () => {
          // Nothing newer came in, so the failed content is what must go out next time.
          if (path === p && !dirty) dirty = true;
          emit("error", p);
        },
      )
      .finally(() => {
        inFlight -= 1;
      });
    queue = job;
    return job;
  }

  function fire() {
    timer = null;
    if (disposed || !dirty) return;
    dirty = false;
    commit(path, content);
  }

  return {
    change(p, c) {
      if (disposed) return;
      if (dirty && path !== null && path !== p) {
        cancel();
        const prevPath = path;
        const prevContent = content;
        dirty = false;
        commit(prevPath, prevContent);
      }
      path = p;
      content = c;
      dirty = true;
      emit("dirty", p);
      cancel();
      timer = st(fire, delay);
    },

    flush() {
      cancel();
      if (!disposed && dirty) {
        dirty = false;
        commit(path, content);
      }
      return queue.then(() => undefined);
    },

    pending() {
      return dirty || inFlight > 0;
    },

    setDelay(ms) {
      if (Number.isFinite(ms) && ms >= 0) delay = ms;
    },

    dispose() {
      disposed = true;
      cancel();
      dirty = false;
    },
  };
}
