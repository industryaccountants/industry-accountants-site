// ── State ──────────────────────────────────────────
let currentUser = null;
let userProfile = null;
let userDocuments = [];
let userMessages = [];

// ── Boot ────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await bootPortal(session.user);
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await bootPortal(session.user);
    } else if (event === 'SIGNED_OUT') {
      showAuthScreen();
    }
  });
});

async function bootPortal(user) {
  currentUser = user;
  await loadProfile(user);
  await loadDocuments(user);
  await loadMessages(user);
  renderPortal();
}

// ── Auth Functions ───────────────────────────────────
async function signIn() {
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  setMsg('Signing in...', '');

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return setMsg(error.message, 'error');
}

async function signUp() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const service = document.getElementById('signup-service').value;

  if (!name || !email || !password || !service) {
    return setMsg('Please fill in all fields', 'error');
  }
  if (password.length < 8) {
    return setMsg('Password must be at least 8 characters', 'error');
  }

  setMsg('Creating your account...', '');

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, service } }
  });

  if (error) return setMsg(error.message, 'error');

  // Insert profile row
  if (data.user) {
    await sb.from('profiles').upsert({
      id: data.user.id,
      full_name: name,
      email,
      service,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  }

  setMsg('Account created! Check your email to confirm, then sign in.', 'success');
}

async function signOut() {
  await sb.auth.signOut();
}

async function resetPassword() {
  const email = document.getElementById('reset-email').value.trim();
  if (!email) return setMsg('Enter your email address', 'error');

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/index.html'
  });

  if (error) return setMsg(error.message, 'error');
  setMsg('Reset link sent! Check your email.', 'success');
}

// ── Profile & Data ───────────────────────────────────
async function loadProfile(user) {
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  userProfile = data || {
    full_name: user.user_metadata?.full_name || user.email.split('@')[0],
    service: user.user_metadata?.service || '—',
    status: 'pending'
  };
}

async function loadDocuments(user) {
  const { data } = await sb.storage.from('client-docs').list(`${user.id}/`, {
    limit: 100, sortBy: { column: 'created_at', order: 'desc' }
  });
  userDocuments = data || [];
}

async function loadMessages(user) {
  const { data } = await sb.from('messages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  userMessages = data || [];
}

// ── Render Portal ─────────────────────────────────────
function renderPortal() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('portal').style.display = 'flex';

  const name = userProfile?.full_name || currentUser.email;
  const firstName = name.split(' ')[0];
  const initial = firstName[0].toUpperCase();

  document.getElementById('user-name-sidebar').textContent = name;
  document.getElementById('user-name-header').textContent = firstName;
  document.getElementById('user-avatar').textContent = initial;

  // Service label
  const serviceLabels = {
    tax: 'Tax Filing', bookkeeping: 'Bookkeeping',
    payroll: 'Payroll Setup', consulting: 'Business Consulting', partner: 'White Label Partner'
  };
  document.getElementById('client-service').textContent =
    serviceLabels[userProfile?.service] || '—';

  // Status
  document.getElementById('filing-status').textContent =
    capitalize(userProfile?.status || 'Pending');

  // Doc count
  document.getElementById('doc-count').textContent = userDocuments.length;

  // Timeline date
  if (userProfile?.created_at) {
    document.getElementById('tl-received-date').textContent =
      new Date(userProfile.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
  }

  renderDocuments();
  renderMessages();

  // Update status timeline
  updateTimeline();
}

function updateTimeline() {
  const status = userProfile?.status || 'pending';
  const stages = ['received', 'intake', 'docs', 'review', 'complete'];
  const statusMap = {
    pending: 0, intake_submitted: 1, docs_received: 2, under_review: 3, complete: 4
  };
  const activeIdx = statusMap[status] ?? 0;

  stages.forEach((stage, i) => {
    const el = document.getElementById(`tl-${stage}`);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < activeIdx) el.classList.add('done');
    else if (i === activeIdx) el.classList.add('active');
  });
}

// ── Document Upload ───────────────────────────────────
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length) processFiles(files);
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}

function handleDragLeave() {
  document.getElementById('upload-zone').classList.remove('drag-over');
}

async function uploadFiles(event) {
  processFiles(event.target.files);
}

async function processFiles(files) {
  if (!currentUser) return;
  const progress = document.getElementById('upload-progress');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');

  progress.style.display = 'block';
  let uploaded = 0;

  for (const file of files) {
    label.textContent = `Uploading ${file.name}...`;
    const path = `${currentUser.id}/${Date.now()}_${file.name}`;
    const { error } = await sb.storage.from('client-docs').upload(path, file, {
      cacheControl: '3600', upsert: false
    });
    if (!error) uploaded++;
    fill.style.width = `${(uploaded / files.length) * 100}%`;
  }

  label.textContent = `${uploaded} file(s) uploaded successfully`;
  setTimeout(() => { progress.style.display = 'none'; fill.style.width = '0%'; }, 2500);

  await loadDocuments(currentUser);
  document.getElementById('doc-count').textContent = userDocuments.length;
  renderDocuments();
  document.getElementById('file-input').value = '';
}

function renderDocuments() {
  const list = document.getElementById('doc-list');
  const empty = document.getElementById('doc-empty');

  // Remove existing doc items
  list.querySelectorAll('.doc-item').forEach(el => el.remove());

  if (!userDocuments.length) {
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  userDocuments.forEach(doc => {
    const ext = doc.name.split('.').pop().toUpperCase().slice(0, 4);
    const size = doc.metadata?.size ? formatBytes(doc.metadata.size) : '';
    const date = doc.created_at
      ? new Date(doc.created_at).toLocaleDateString() : '';

    const item = document.createElement('div');
    item.className = 'doc-item';
    item.innerHTML = `
      <div class="doc-icon">${ext}</div>
      <div class="doc-info">
        <div class="doc-name">${doc.name.replace(/^\d+_/, '')}</div>
        <div class="doc-meta">${[size, date].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="doc-actions">
        <button class="btn-icon" onclick="downloadDoc('${doc.name}')" title="Download">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn-icon del" onclick="deleteDoc('${doc.name}')" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>`;
    list.appendChild(item);
  });
}

async function downloadDoc(name) {
  const path = `${currentUser.id}/${name}`;
  const { data } = await sb.storage.from('client-docs').createSignedUrl(path, 60);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
}

async function deleteDoc(name) {
  if (!confirm('Delete this file?')) return;
  const path = `${currentUser.id}/${name}`;
  await sb.storage.from('client-docs').remove([path]);
  await loadDocuments(currentUser);
  document.getElementById('doc-count').textContent = userDocuments.length;
  renderDocuments();
}

// ── Messages ──────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  const { error } = await sb.from('messages').insert({
    user_id: currentUser.id,
    sender: 'client',
    content: text,
    created_at: new Date().toISOString()
  });

  if (!error) {
    input.value = '';
    await loadMessages(currentUser);
    renderMessages();
  }
}

function renderMessages() {
  const area = document.getElementById('messages-area');
  area.innerHTML = '';

  if (!userMessages.length) {
    area.innerHTML = `<div class="msg-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 0 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <p>No messages yet. We'll reach out within 1 business day.</p>
    </div>`;
    return;
  }

  userMessages.forEach(msg => {
    const isClient = msg.sender === 'client';
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = isClient ? 'flex-end' : 'flex-start';
    div.innerHTML = `
      <div class="msg-bubble ${isClient ? 'from-client' : ''}">${escapeHtml(msg.content)}</div>
      <div class="msg-meta">${isClient ? 'You' : 'Your Accountant'} · ${new Date(msg.created_at).toLocaleString()}</div>`;
    area.appendChild(div);
  });

  area.scrollTop = area.scrollHeight;
}

// ── Intake Forms ──────────────────────────────────────
function openForm(type) {
  const url = TALLY_FORMS[type];
  if (!url) return;
  document.getElementById('tally-frame').src = url;
  document.querySelector('.form-cards').style.display = 'none';
  document.getElementById('tally-embed').style.display = 'block';
}

function closeForm() {
  document.getElementById('tally-frame').src = '';
  document.getElementById('tally-embed').style.display = 'none';
  document.querySelector('.form-cards').style.display = 'grid';
}

// ── UI Helpers ────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active');

  // Reset intake view when switching back
  if (name === 'intake') {
    document.querySelector('.form-cards').style.display = 'grid';
    document.getElementById('tally-embed').style.display = 'none';
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.textContent.toLowerCase().includes(tab === 'signin' ? 'sign' : tab === 'signup' ? 'new' : 'reset')) {
      b.classList.add('active');
    }
  });
  clearMsg();
}

function showReset() {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-reset').classList.add('active');
  clearMsg();
}

function showAuthScreen() {
  document.getElementById('portal').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  currentUser = null;
  userProfile = null;
}

function setMsg(text, type) {
  const el = document.getElementById('auth-msg');
  el.textContent = text;
  el.className = `auth-msg ${type}`;
}

function clearMsg() {
  setMsg('', '');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
