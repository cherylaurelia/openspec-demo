import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNote, listNotes, deleteNote } from '../src/store.js';
test('add and delete', () => { const n = addNote('hi'); assert.equal(listNotes().length, 1); assert.ok(deleteNote(n.id)); assert.equal(listNotes().length, 0); });
