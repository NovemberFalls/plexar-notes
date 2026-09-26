// Back and forward history of opened note paths, like a browser: opening a note pushes it
// and drops anything ahead of the current position. Pure logic, no DOM.

export function createHistory() {
  const stack = [];
  let index = -1;

  return {
    // Record a path as the newest entry. Re-opening the current entry is a no-op.
    push(path) {
      if (typeof path !== "string" || !path) return;
      if (index >= 0 && stack[index] === path) return;
      stack.splice(index + 1);
      stack.push(path);
      index = stack.length - 1;
    },
    // Move one step and return the path there, or null when there is nowhere to go.
    back() {
      if (index <= 0) return null;
      index -= 1;
      return stack[index];
    },
    forward() {
      if (index >= stack.length - 1) return null;
      index += 1;
      return stack[index];
    },
    canBack() {
      return index > 0;
    },
    canForward() {
      return index < stack.length - 1;
    },
    current() {
      return index >= 0 ? stack[index] : null;
    },
    // A closed or deleted note should no longer be reachable through the arrows.
    remove(path) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] !== path) continue;
        stack.splice(i, 1);
        if (i <= index) index -= 1;
      }
      // Collapse neighbours that became identical after the removal.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i] === stack[i - 1]) {
          stack.splice(i, 1);
          if (i <= index) index -= 1;
        }
      }
      if (index < 0 && stack.length) index = 0;
    },
    entries() {
      return stack.slice();
    },
  };
}
