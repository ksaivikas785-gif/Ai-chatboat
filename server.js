require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Database ----------
const db = new Database(path.join(__dirname, 'chat.db'));
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ---------- Auth ----------
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

const makeToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

app.post('/api/signup', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const user = { id: info.lastInsertRowid, email };
  res.json({ token: makeToken(user), email });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(400).json({ error: 'Wrong email or password' });
  res.json({ token: makeToken(user), email: user.email });
});

// ---------- Chats ----------
function ownChat(req, res) {
  const chat = db
    .prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!chat) res.status(404).json({ error: 'Chat not found' });
  return chat;
}

app.get('/api/chats', auth, (req, res) => {
  const chats = db
    .prepare('SELECT id, title FROM chats WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.id);
  res.json(chats);
});

app.post('/api/chats', auth, (req, res) => {
  const info = db.prepare('INSERT INTO chats (user_id) VALUES (?)').run(req.user.id);
  res.json({ id: info.lastInsertRowid, title: 'New chat' });
});

app.delete('/api/chats/:id', auth, (req, res) => {
  const chat = ownChat(req, res);
  if (!chat) return;
  db.prepare('DELETE FROM chats WHERE id = ?').run(chat.id);
  res.json({ ok: true });
});

app.get('/api/chats/:id/messages', auth, (req, res) => {
  const chat = ownChat(req, res);
  if (!chat) return;
  const msgs = db
    .prepare('SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id')
    .all(chat.id);
  res.json(msgs);
});

app.post('/api/chats/:id/messages', auth, async (req, res) => {
  const chat = ownChat(req, res);
  if (!chat) return;
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Message is empty' });

  db.prepare('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)')
    .run(chat.id, 'user', content);

  if (chat.title === 'New chat') {
    const title = content.length > 40 ? content.slice(0, 40) + '…' : content;
    db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(title, chat.id);
  }

  const history = db
    .prepare('SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id')
    .all(chat.id);

  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: history, stream: false }),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Ollama error: ${text}`);
    }
    const data = await r.json();
    const reply = data.message?.content || '(no response)';
    db.prepare('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)')
      .run(chat.id, 'assistant', reply);
    const updated = db.prepare('SELECT title FROM chats WHERE id = ?').get(chat.id);
    res.json({ reply, title: updated.title });
  } catch (err) {
    console.error(err.message);
    res.status(502).json({
      error: 'Could not reach Ollama. Is it running, and did you run "ollama pull ' + MODEL + '"?',
    });
  }
});

app.listen(PORT, () => console.log(`Chatbot running at http://localhost:${PORT}`));