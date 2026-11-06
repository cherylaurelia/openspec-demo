import { createServer } from 'node:http';
import { listNotes, addNote, deleteNote } from './store.js';

export function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/notes') return send(res, 200, listNotes());
  if (req.method === 'POST' && url.pathname === '/notes') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { text } = JSON.parse(body || '{}');
      if (!text) return send(res, 400, { error: 'text is required' });
      send(res, 201, addNote(text));
    });
    return;
  }
  const m = url.pathname.match(/^\/notes\/(\d+)$/);
  if (req.method === 'DELETE' && m) return deleteNote(Number(m[1])) ? send(res, 204) : send(res, 404, { error: 'not found' });
  send(res, 404, { error: 'not found' });
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(data === undefined ? '' : JSON.stringify(data));
}

if (process.argv[1] === new URL(import.meta.url).pathname) createServer(handler).listen(3001);
