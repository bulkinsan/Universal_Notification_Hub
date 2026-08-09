const API = '/api/v1';
const TOKEN_KEY = 'hub_admin_token';
const USER_KEY = 'hub_admin_user';

let token = localStorage.getItem(TOKEN_KEY) || null;
let currentView = 'overview';

function $id(id) { return document.getElementById(id); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function badgeFor(status) {
  const cls = ['sent', 'failed', 'partial', 'pending', 'active', 'inactive'].includes(status) ? status : 'pending';
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { ...opts, headers });
  let body = null;
  try { body = await res.json(); } catch { /* no body */ }
  if (res.status === 401 && path !== '/admin/login') {
    logout();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const msg = (body && body.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

/* ---------- Views ---------- */

async function renderOverview() {
  const el = $id('view-overview');
  el.innerHTML = '<div class="muted">Loading...</div>';
  try {
    const s = await api('/admin/stats');
    el.innerHTML = `
      <div class="cards">
        <div class="stat-card"><div class="value">${s.sources_total}</div><div class="label">Sources</div></div>
        <div class="stat-card"><div class="value">${s.sources_active}</div><div class="label">Active</div></div>
        <div class="stat-card"><div class="value">${s.users_total}</div><div class="label">Users</div></div>
        <div class="stat-card"><div class="value">${s.subscriptions_active}</div><div class="label">Subscriptions</div></div>
        <div class="stat-card"><div class="value">${s.notifications_total}</div><div class="label">Notifications</div></div>
      </div>
      <div class="card">
        <div class="card-title">Delivery</div>
        <div class="bar-row"><span>Sent</span>
          <div class="bar-track"><div class="bar-fill sent" style="width:${barPct(s.deliveries_sent, s.deliveries_sent + s.deliveries_failed)}%"></div></div>
          <span>${s.deliveries_sent}</span></div>
        <div class="bar-row"><span>Failed</span>
          <div class="bar-track"><div class="bar-fill failed" style="width:${barPct(s.deliveries_failed, s.deliveries_sent + s.deliveries_failed)}%"></div></div>
          <span>${s.deliveries_failed}</span></div>
      </div>
      <div class="card">
        <div class="card-title">Sources</div>
        <table><thead><tr><th>Name</th><th>Domain</th><th>Subscribers</th><th>Status</th></tr></thead>
        <tbody>${(await sourceRows()).join('')}</tbody></table>
      </div>`;
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function sourceRows() {
  const sources = await api('/admin/sources');
  return sources.slice(0, 10).map((s) => `
    <tr>
      <td>${s.logo_path ? `<img class="thumb" src="/uploads/${esc(s.logo_path)}" alt="">` : '<span class="thumb"></span>'} ${esc(s.name)}</td>
      <td>${esc(s.domain)}</td>
      <td>${s.subscribers_count}</td>
      <td>${badgeFor(s.is_active ? 'active' : 'inactive')}</td>
    </tr>`);
}

function barPct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

async function renderSources() {
  const el = $id('view-sources');
  el.innerHTML = `
    <div class="row">
      <div class="card-title">Sources</div>
      <div style="margin-left:auto"><button class="btn btn-primary" onclick="openSourceModal()">+ New source</button></div>
    </div>
    <div class="card"><div class="muted">Loading...</div></div>`;
  try {
    const sources = await api('/admin/sources');
    const html = sources.map((s) => `
      <div class="card">
        <div class="row">
          ${s.logo_path ? `<img class="thumb" src="/uploads/${esc(s.logo_path)}" alt="">` : '<span class="thumb"></span>'}
          <div style="flex:1;min-width:200px">
            <div style="font-weight:600">${esc(s.name)}</div>
            <div class="muted" style="font-size:12px">${esc(s.domain)}</div>
            ${s.description ? `<div class="muted" style="font-size:13px;margin-top:4px">${esc(s.description)}</div>` : ''}
            <div style="margin-top:4px">${badgeFor(s.is_active ? 'active' : 'inactive')} <span class="muted">· ${s.subscribers_count} subscribers</span></div>
          </div>
          <div class="actions">
            <button class="btn btn-ghost" onclick="openSourceModal('${s.id}')">Edit</button>
            <button class="btn btn-ghost" onclick="showApiKey('${s.id}')">API key</button>
            <button class="btn btn-ghost" onclick="openLogoModal('${s.id}')">Logo</button>
            <button class="btn ${s.is_active ? 'btn-danger' : 'btn-primary'}"
                    onclick="toggleSource('${s.id}', ${s.is_active})">${s.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>
      </div>`).join('');
    el.querySelector('.card').outerHTML = `<div class="section">${html || '<p class="muted">No sources yet.</p>'}</div>`;
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function renderNotifications() {
  const el = $id('view-notifications');
  el.innerHTML = `
    <div class="card">
      <form class="row" onsubmit="event.preventDefault(); loadNotifications()">
        <label style="flex:1;min-width:160px">Source
          <select id="f-source"><option value="">All</option></select>
        </label>
        <label style="flex:1;min-width:140px">Status
          <select id="f-status">
            <option value="">All</option>
            <option>sent</option><option>failed</option><option>partial</option><option>pending</option>
          </select>
        </label>
        <button class="btn btn-primary" style="align-self:flex-end">Filter</button>
      </form>
    </div>
    <div id="notif-list"><div class="muted">Loading...</div></div>
    <div class="pagination" id="notif-pagination"></div>`;

  try {
    const sources = await api('/admin/sources');
    $id('f-source').innerHTML = '<option value="">All</option>' +
      sources.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
  await loadNotifications();
}

let notifOffset = 0;
const NOTIF_LIMIT = 20;

async function loadNotifications() {
  const source = $id('f-source').value;
  const status = $id('f-status').value;
  const params = new URLSearchParams({ limit: NOTIF_LIMIT, offset: notifOffset });
  if (source) params.set('source_id', source);
  if (status) params.set('status', status);

  try {
    const list = await api('/admin/notifications?' + params.toString());
    $id('notif-list').innerHTML = `
      <table>
        <thead><tr><th>Time</th><th>Source</th><th>Title</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${list.map((n) => `
            <tr>
              <td>${esc(new Date(n.created_at + 'Z').toLocaleString())}</td>
              <td>${esc(n.source_name)}</td>
              <td>${esc(n.title)}</td>
              <td>${badgeFor(n.status)}</td>
              <td><button class="btn btn-ghost" onclick="showNotification('${n.id}')">Details</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    const hasMore = list.length === NOTIF_LIMIT;
    $id('notif-pagination').innerHTML = `
      <button class="btn btn-ghost" ${notifOffset === 0 ? 'disabled' : ''} onclick="notifOffset=Math.max(0,notifOffset-${NOTIF_LIMIT});loadNotifications()">Prev</button>
      <span class="muted">offset ${notifOffset}</span>
      <button class="btn btn-ghost" ${hasMore ? '' : 'disabled'} onclick="notifOffset+=${NOTIF_LIMIT};loadNotifications()">Next</button>`;
  } catch (e) {
    $id('notif-list').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function showNotification(id) {
  try {
    const n = await api(`/admin/notifications/${id}`);
    const deliveries = (n.deliveries || []).map((d) => `
      <tr>
        <td style="font-family:monospace;font-size:12px">${esc(d.user_id)}</td>
        <td>${esc(d.device_type)}</td>
        <td>${badgeFor(d.status)}</td>
        <td>${d.sent_at ? esc(d.sent_at) : ''}</td>
        <td>${esc(d.error || '')}</td>
      </tr>`).join('');
    openModal(`
      <h2>${esc(n.title)}</h2>
      <p class="muted">Source: ${esc(n.source_name)} · ${esc(new Date(n.created_at + 'Z').toLocaleString())}</p>
      <p class="mt">${esc(n.body || '')}</p>
      ${n.data ? `<div class="key-box mt">${esc(n.data)}</div>` : ''}
      <div class="card-title mt">Deliveries (${n.deliveries.length})</div>
      <table>
        <thead><tr><th>User</th><th>Device</th><th>Status</th><th>Sent at</th><th>Error</th></tr></thead>
        <tbody>${deliveries || '<tr><td colspan="5" class="muted">No deliveries</td></tr>'}</tbody>
      </table>
      <div class="row mt"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
    `);
  } catch (e) {
    alert(e.message);
  }
}

/* ---------- Source CRUD ---------- */

async function openSourceModal(id) {
  let src = { name: '', domain: '', description: '', website_url: '' };
  if (id) {
    try { src = await api(`/admin/sources/${id}`); } catch (e) { return alert(e.message); }
  }
  openModal(`
    <h2>${id ? 'Edit source' : 'New source'}</h2>
    <form onsubmit="event.preventDefault(); saveSource('${id || ''}')">
      <label>Name<input id="m-name" value="${esc(src.name)}" required maxlength="100"></label>
      <label>Domain<input id="m-domain" value="${esc(src.domain)}" required maxlength="255" ${id ? 'disabled' : ''}></label>
      <label>Website URL<input id="m-website" value="${esc(src.website_url || '')}" maxlength="255"></label>
      <label>Description<textarea class="textarea-w" id="m-desc">${esc(src.description || '')}</textarea></label>
      <div class="row">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      </div>
    </form>
    <p id="m-error" class="error hidden"></p>`);
}

async function saveSource(id) {
  const payload = {
    name: $id('m-name').value,
    website_url: $id('m-website').value || null,
    description: $id('m-desc').value || null,
  };
  try {
    if (id) {
      await api(`/admin/sources/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      closeModal();
    } else {
      payload.domain = $id('m-domain').value;
      const created = await api('/admin/sources', { method: 'POST', body: JSON.stringify(payload) });
      showNewKey(created);
    }
    await renderSources();
  } catch (e) {
    $id('m-error').textContent = e.message;
    $id('m-error').classList.remove('hidden');
  }
}

function showNewKey(source) {
  openModal(`
    <h2>Source created</h2>
    <p>Your API key is shown only once. Store it securely.</p>
    <div class="key-box">${esc(source.api_key)}</div>
    <div class="row mt">
      <button class="btn btn-primary" onclick="closeModal()">Done</button>
    </div>`);
}

async function toggleSource(id, active) {
  try {
    await api(`/admin/sources/${id}/${active ? 'deactivate' : 'activate'}`, { method: 'POST' });
    await renderSources();
    if (currentView === 'overview') await renderOverview();
  } catch (e) {
    alert(e.message);
  }
}

async function showApiKey(id) {
  if (!confirm('Generate a new API key? The old key will stop working immediately.')) return;
  try {
    const r = await api(`/admin/sources/${id}/api-key`, { method: 'POST' });
    openModal(`
      <h2>New API key</h2>
      <p>Shown once. Old key is now invalid.</p>
      <div class="key-box">${esc(r.api_key)}</div>
      <div class="row mt"><button class="btn btn-primary" onclick="closeModal()">Done</button></div>`);
  } catch (e) {
    alert(e.message);
  }
}

function openLogoModal(id) {
  openModal(`
    <h2>Upload logo</h2>
    <form onsubmit="event.preventDefault(); uploadLogo('${id}')">
      <input type="file" id="m-logo" accept="image/jpeg,image/png,image/webp" required>
      <div class="row mt">
        <button type="submit" class="btn btn-primary">Upload</button>
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      </div>
    </form>
    <p id="m-error" class="error hidden"></p>`);
}

async function uploadLogo(id) {
  const file = $id('m-logo').files[0];
  if (!file) return;
  const form = new FormData();
  form.append('logo', file);
  try {
    await fetch(`${API}/admin/sources/${id}/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
    });
    closeModal();
    await renderSources();
  } catch (e) {
    $id('m-error').textContent = e.message;
    $id('m-error').classList.remove('hidden');
  }
}

/* ---------- Modal helpers ---------- */

function openModal(html) {
  $id('modal-body').innerHTML = html;
  $id('modal').classList.remove('hidden');
}

function closeModal() {
  $id('modal').classList.add('hidden');
}

/* ---------- App / views ---------- */

function logout() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  $id('app-view').classList.add('hidden');
  $id('login-view').classList.remove('hidden');
}

async function switchView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  $id('view-' + name).classList.remove('hidden');
  if (name === 'overview') await renderOverview();
  if (name === 'sources') await renderSources();
  if (name === 'notifications') { notifOffset = 0; await renderNotifications(); }
}

async function bootstrap() {
  document.querySelectorAll('.tab').forEach((btn) =>
    btn.addEventListener('click', () => switchView(btn.dataset.view))
  );
  $id('logout-btn').addEventListener('click', logout);
  $id('modal').addEventListener('click', (e) => { if (e.target === $id('modal')) closeModal(); });

  $id('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $id('login-error');
    err.classList.add('hidden');
    try {
      const r = await fetch(API + '/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $id('login-username').value, password: $id('login-password').value }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Login failed');
      token = body.token;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, body.username);
      $id('admin-name').textContent = 'Signed in as ' + body.username;
      $id('login-view').classList.add('hidden');
      $id('app-view').classList.remove('hidden');
      await switchView('overview');
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  });

  if (token) {
    try {
      const me = await api('/admin/me');
      $id('admin-name').textContent = 'Signed in as ' + me.username;
      $id('login-view').classList.add('hidden');
      $id('app-view').classList.remove('hidden');
      await switchView('overview');
    } catch {
      logout();
    }
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

window.openSourceModal = openSourceModal;
window.showApiKey = showApiKey;
window.openLogoModal = openLogoModal;
window.toggleSource = toggleSource;
window.showNotification = showNotification;
window.closeModal = closeModal;
window.loadNotifications = loadNotifications;
