const undoStack = [];
const MAX_STACK = 50;

export function recordUndo(entry) {
  if (!entry) return;
  undoStack.push(entry);
  if (undoStack.length > MAX_STACK) {
    undoStack.shift();
  }
}

export function hasUndo() {
  return undoStack.length > 0;
}

export async function applyUndo(db) {
  if (!undoStack.length) return null;
  const entry = undoStack.pop();
  await db.exec("BEGIN");
  try {
    for (const step of entry.steps) {
      await db.run(step.sql, step.params ?? []);
    }
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
  return entry;
}
