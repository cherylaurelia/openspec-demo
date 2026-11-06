const notes = [];
let nextId = 1;
export const listNotes = () => notes;
export function addNote(text) { const n = { id: nextId++, text, createdAt: new Date().toISOString() }; notes.push(n); return n; }
export function deleteNote(id) { const i = notes.findIndex((n) => n.id === id); if (i < 0) return false; notes.splice(i, 1); return true; }
