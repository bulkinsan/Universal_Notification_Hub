const API_BASE = '/api/v1';

function getUserId() {
  let id = localStorage.getItem('hub_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('hub_user_id', id);
  }
  return id;
}

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return body;
}

let swReg = null;
let userId = getUserId();

async function init() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    document.getElementById('app').innerHTML =
      '<p class=error>Your browser does not support push notifications.</p>';
    return;
  }

  swReg = await navigator.serviceWorker.register('/pwa/sw.js');
  await loadSources();
}

async function loadSources() {
  const list = document.getElementById('sources-list');
  const loading = document.getElementById('loading');
  if (loading) loading.remove();

  try {
    const sources = await api('/sources');
    const subs = await api('/subscribe?user_id=' + userId);
    const subMap = {};
    (Array.isArray(subs) ? subs : []).forEach((s) => (subMap[s.id] = true));

    if (!Array.isArray(sources) || sources.length === 0) {
      list.innerHTML = '<p class=muted>No sources available yet.</p>';
      return;
    }

    list.innerHTML = sources
      .map(
        (s) => `
      <div class="source-card ${subMap[s.id] ? 'subscribed' : ''}" data-id="${s.id}">
        <div class="source-info">
          <img class="source-logo" src="${s.logo_path ? '/uploads/' + s.logo_path : 'icon-192.png'}"
               alt="${s.name}" onerror="this.src='icon-192.png'">
          <div>
            <div class="source-name">${esc(s.name)}</div>
            <div class="source-domain">${esc(s.domain)}</div>
            ${s.description ? '<div class="source-desc">' + esc(s.description) + '</div>' : ''}
          </div>
        </div>
        <button class="sub-btn" data-action="${subMap[s.id] ? 'unsubscribe' : 'subscribe'}"
                data-id="${s.id}">
          ${subMap[s.id] ? 'Unsubscribe' : 'Subscribe'}
        </button>
      </div>
    `
      )
      .join('');

    document.querySelectorAll('.sub-btn').forEach((btn) =>
      btn.addEventListener('click', onSubBtnClick)
    );
  } catch (err) {
    console.error('Failed to load sources:', err);
    list.innerHTML = '<p class=error>Failed to load sources: ' + esc(err.message) + '</p>';
  }
}

async function onSubBtnClick(e) {
  const btn = e.currentTarget;
  const sourceId = btn.dataset.id;
  const action = btn.dataset.action;

  btn.disabled = true;

  try {
    if (action === 'subscribe') {
      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subData = sub.toJSON();

      await api('/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          source_id: sourceId,
          device_type: 'pwa',
          push_subscription: subData,
        }),
      });
    } else {
      await api('/subscribe', {
        method: 'DELETE',
        body: JSON.stringify({ user_id: userId, source_id: sourceId }),
      });
    }

    await loadSources();
  } catch (err) {
    console.error('Subscription action failed:', err);
    alert('Failed: ' + err.message);
  }

  btn.disabled = false;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
