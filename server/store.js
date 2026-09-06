const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'sessions.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ sessions: {} }, null, 2), 'utf8');
  }
}

function read() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    return { sessions: {} };
  }
}

function write(data) {
  ensure();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function emptyProgress() {
  return {
    name: '',
    score: 0,
    attractions: {},
    games: {},
    quiz: null,
    certificate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getOrCreateSession(sessionId) {
  const db = read();
  if (sessionId && db.sessions[sessionId]) {
    return { id: sessionId, ...db.sessions[sessionId] };
  }
  const id = crypto.randomUUID();
  db.sessions[id] = emptyProgress();
  write(db);
  return { id, ...db.sessions[id] };
}

function saveSession(id, session) {
  const db = read();
  const { id: _omit, ...rest } = session;
  rest.updatedAt = new Date().toISOString();
  db.sessions[id] = rest;
  write(db);
  return { id, ...rest };
}

function updateSession(id, mutator) {
  const session = getOrCreateSession(id);
  const next = mutator({ ...session });
  return saveSession(session.id, next);
}

module.exports = {
  getOrCreateSession,
  saveSession,
  updateSession,
};
