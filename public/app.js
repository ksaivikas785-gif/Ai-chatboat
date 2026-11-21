const $ = (s) => document.querySelector(s);

let token = localStorage.getItem('token');
let currentChat = null;
let signupMode = false;
let sending = false;

/* ---------- Helpers ---------- */
async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) logout();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ---------- Theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
}
setTheme(localStorage.getItem('theme') || 'dark');
$('#theme-btn').onclick = () =>
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/* ---------- Auth ---------- */
function showAuth() {
  $('#app').classList.add('hidden');
  $('#auth').classList.remove('hidden');
}

function showApp() {
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#user-email').textContent = localStorage.getItem('email') || '';
  loadChats(true);
}

function logout() {
  token = null;
  currentChat = null;
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  showAuth();
}

$('#auth-toggle').onclick = (e) => {
  e.preventDefault();
  signupMode = !signupMode;
  $('#auth-sub').textContent = signupMode ? 'Create your account' : 'Log in to continue';
  $('#auth-btn').textContent = signupMode ? 'Sign up' : 'Log in';
  $('#auth-toggle').textContent = signupMode ? 'Have an account? Log in' : 'No account? Sign up';
  $('#auth-error').textContent = '';
};

async function submitAuth() {
  $('#auth-error').textContent = '';
  try {
    const data = await api(signupMode ? '/api/signup' : '/api/login', 'POST', {
      email: $('#email').value,
      password: $('#password').value,
    });
    token = data.token;
    localStorage.setItem('token', token);
    localStorage.setItem('email', data.email);
    $('#password').value = '';
    showApp();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
}
$('#auth-btn').onclick = submitAuth;
$('#password').addEventListener('keydown', (e) => e.key === 'Enter' && submitAuth());
$('#logout-btn').onclick = logout;

/* ---------- Chats sidebar ---------- */
async function loadChats(openFirst = false) {
  const chats = await api('/api/chats');
  const list = $('#chat-list');
  list.innerHTML = '';
  chats.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (c.id === currentChat ? ' active' : '');

    const t = document.createElement('span');
    t.className = 't';
    t.textContent = c.title;

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Delete chat';
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this chat?')) return;
      await api('/api/chats/' + c.id, 'DELETE');
      if (currentChat === c.id) {
        currentChat = null;
        renderEmpty();
      }
      loadChats();
    };

    item.onclick = () => openChat(c.id);
    item.append(t, del);
    list.appendChild(item);
  });

  if (openFirst && chats.length) openChat(chats[0].id);
  else if (openFirst) renderEmpty();
}

async function openChat(id) {
  currentChat = id;
  const msgs = await api(`/api/chats/${id}/messages`);
  const box = $('#messages');
  box.innerHTML = '';
  if (!msgs.length) renderEmpty();
  msgs.forEach((m) => addMessage(m.role, m.content));
  document.querySelectorAll('.chat-item').forEach((el) => el.classList.remove('active'));
  loadChats();
}

function renderEmpty() {
  $('#messages').innerHTML = '<div class="empty">Start a new chat and ask me anything.</div>';
}

$('#new-chat').onclick = async () => {
  const chat = await api('/api/chats', 'POST');
  currentChat = chat.id;
  renderEmpty();
  await loadChats();
  $('#input').focus();
};

/* ---------- Messages ---------- */
function addMessage(role, text) {
  const box = $('#messages');
  box.querySelector('.empty')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text; // textContent prevents HTML injection
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
  return wrap;
}

async function sendMessage() {
  const input = $('#input');
  const text = input.value.trim();
  if (!text || sending) return;

  if (!currentChat) {
    const chat = await api('/api/chats', 'POST');
    currentChat = chat.id;
  }

  sending = true;
  $('#send-btn').disabled = true;
  input.value = '';
  input.style.height = 'auto';

  addMessage('user', text);
  const thinking = addMessage('assistant', 'Thinking…');

  try {
    const data = await api(`/api/chats/${currentChat}/messages`, 'POST', { content: text });
    thinking.querySelector('.bubble').textContent = data.reply;
    loadChats();
  } catch (err) {
    thinking.className = 'msg error';
    thinking.querySelector('.bubble').textContent = err.message;
  } finally {
    sending = false;
    $('#send-btn').disabled = false;
    $('#messages').scrollTop = $('#messages').scrollHeight;
    input.focus();
  }
}

$('#send-btn').onclick = sendMessage;
$('#input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
$('#input').addEventListener('input', (e) => {
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
});

/* ---------- Start ---------- */
if (token) showApp();
else showAuth();