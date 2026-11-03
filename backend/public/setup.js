// Jiko web setup. No framework: four sections, one JSON API (the same one the
// apps use). Tokens live in sessionStorage so closing the tab signs you out.
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STEPS = ['account', 'connect', 'tune', 'apps'];
  const DEFAULT_PRESETS = ['deadline_reminder', 'deadline_drift', 'nightly_summary'];

  const store = {
    get: k => { try { return sessionStorage.getItem(`jiko.${k}`); } catch { return null; } },
    set: (k, v) => { try { v == null ? sessionStorage.removeItem(`jiko.${k}`) : sessionStorage.setItem(`jiko.${k}`, v); } catch { /* private mode */ } },
  };

  // ------------------------------------------------------------------ api
  async function api(method, path, body, retry = true) {
    const headers = { 'content-type': 'application/json' };
    const token = store.get('token');
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 401 && retry && store.get('refresh')) {
      const r = await fetch('/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: store.get('refresh') }) });
      if (r.ok) { store.set('token', (await r.json()).token); return api(method, path, body, false); }
      signOut();
      throw new Error('your session ended. sign in again.');
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error((data && (data.message || data.error)) || `something went wrong (${res.status})`);
    return data;
  }

  function showError(scope, err) {
    const el = $('.error', scope);
    if (!el) return;
    el.textContent = err ? (err.message || String(err)) : '';
    el.hidden = !err;
  }

  async function busy(button, fn) {
    if (button) button.disabled = true;
    try { return await fn(); } finally { if (button) button.disabled = false; }
  }

  // ------------------------------------------------------------------ steps
  function show(step) {
    if (!store.get('token')) step = 'account';
    STEPS.forEach(s => { $(`#${s}`).hidden = s !== step; });
    const idx = STEPS.indexOf(step);
    $$('.steps li').forEach((li, i) => {
      li.classList.toggle('current', i === idx);
      li.classList.toggle('done', i < idx);
    });
    store.set('step', step);
    if (step === 'connect') renderIntegrations();
    if (step === 'tune') loadPrefs();
    if (step === 'apps') $$('.server').forEach(el => { el.textContent = location.origin; });
    window.scrollTo(0, 0);
  }

  function signOut() {
    store.set('token', null); store.set('refresh', null); store.set('step', null);
    show('account');
  }

  // ------------------------------------------------------------------ account
  let mode = 'signup';
  function setMode(m) {
    mode = m;
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    $$('[data-only="signup"]').forEach(el => { el.hidden = m !== 'signup'; });
    $('#account-form input[name=password]').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    showError($('#account'), null);
  }

  async function submitAccount(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const phone = form.phone.value.trim();
    const password = form.password.value;
    showError($('#account'), null);
    if (!phone || !password) return showError($('#account'), new Error('phone number and password, please.'));
    await busy($('button[type=submit]', form), async () => {
      try {
        const body = mode === 'signup'
          ? { phone_number: phone, password, ...(form.nickname.value.trim() ? { nickname: form.nickname.value.trim() } : {}) }
          : { phone_number: phone, password };
        const out = await api('POST', mode === 'signup' ? '/auth/signup' : '/auth/login', body, false);
        store.set('token', out.token); store.set('refresh', out.refreshToken);
        if (mode === 'signup') await firstRun();
        form.password.value = '';
        show('connect');
      } catch (err) { showError($('#account'), err); }
    });
  }

  /** New account: the user's timezone and the rules that need nothing but a deadline. */
  async function firstRun() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    try { await api('PATCH', '/users/preferences', { timezone: tz }); } catch { /* tune step retries */ }
    await ensurePresets();
  }

  function tonightAt(h, m) {
    const d = new Date(); d.setHours(h, m, 0, 0);
    if (d < new Date()) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  async function ensurePresets() {
    let existing = [];
    try { existing = (await api('GET', '/triggers')).map(t => t.source); } catch { return; }
    for (const id of DEFAULT_PRESETS) {
      if (existing.includes(`preset:${id}`)) continue;
      const params = id === 'nightly_summary' ? { at: tonightAt(21, 30) } : {};
      try { await api('POST', `/triggers/presets/${id}`, params); } catch { /* not fatal */ }
    }
  }

  // ------------------------------------------------------------------ connect
  function ago(iso) {
    if (!iso) return 'not synced yet';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'synced just now';
    if (mins < 60) return `synced ${mins} min ago`;
    const h = Math.round(mins / 60);
    return h < 24 ? `synced ${h}h ago` : `synced ${Math.round(h / 24)}d ago`;
  }

  function statusLine(i) {
    if (i.status === 'needs_reauth') return { text: 'needs reconnecting', cls: 'warn' };
    const who = i.account ? `${i.account} · ` : '';
    const err = i.last_status === 'error' ? ' · last sync failed' : '';
    return { text: `connected · ${who}${ago(i.last_synced_at)}${err}`, cls: i.last_status === 'error' ? 'warn' : 'on' };
  }

  let pollTimer = null;
  async function renderIntegrations() {
    let data;
    try { data = await api('GET', '/integrations'); } catch (err) { showError($('#card-google'), err); return; }
    const by = Object.fromEntries(data.integrations.map(i => [i.provider, i]));

    // google
    const g = by.google, gCard = $('#card-google'), gStatus = $('.status', gCard), gActions = $('.actions', gCard);
    gActions.innerHTML = '';
    if (!data.available.google) {
      gStatus.textContent = 'not available yet'; gStatus.className = 'status';
      gActions.innerHTML = '<p class="fine">Google sign-in has not been switched on for this server yet. skip it for now; you can connect it later from the app.</p>';
    } else if (g) {
      const s = statusLine(g); gStatus.textContent = s.text; gStatus.className = `status ${s.cls}`;
      if (g.status === 'needs_reauth') gActions.append(button('reconnect google', 'google-connect', 'primary'));
      else gActions.append(button('sync now', 'google-sync'));
      gActions.append(button('disconnect', 'google-disconnect', 'quiet'));
      if (g.last_error && g.status !== 'needs_reauth') showError(gCard, new Error(g.last_error));
    } else {
      gStatus.textContent = ''; gStatus.className = 'status';
      gActions.append(button('connect google', 'google-connect', 'primary'));
    }

    // canvas
    const c = by.canvas, cCard = $('#card-canvas'), cStatus = $('.status', cCard);
    $('#canvas-form').hidden = Boolean(c && c.status !== 'needs_reauth');
    $('.connected-actions', cCard).hidden = !c;
    if (c) {
      const s = statusLine(c); cStatus.textContent = s.text; cStatus.className = `status ${s.cls}`;
      if (c.base_url) $('#canvas-form').base_url.value = c.base_url.replace(/^https:\/\//, '');
    } else { cStatus.textContent = ''; cStatus.className = 'status'; }
    if (!data.available.canvas) {
      cStatus.textContent = 'not available yet';
      $('#canvas-form').hidden = true;
    }
    return by;
  }

  function button(label, act, cls = '') {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.dataset.act = act; if (cls) b.className = cls;
    return b;
  }

  /** After Google sends the user back, the first sync is still running. Watch it land. */
  function pollUntilSynced(provider, tries = 10) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      const by = await renderIntegrations();
      if (by && by[provider] && !by[provider].last_synced_at && tries > 1) pollUntilSynced(provider, tries - 1);
    }, 3000);
  }

  const actions = {
    'google-connect': async b => busy(b, async () => {
      try {
        const { url } = await api('POST', '/integrations/google/start', { return: 'setup' });
        location.href = url;
      } catch (err) { showError($('#card-google'), err); }
    }),
    'google-sync': async b => busy(b, async () => {
      try { await api('POST', '/integrations/google/sync'); showError($('#card-google'), null); } catch (err) { showError($('#card-google'), err); }
      renderIntegrations();
    }),
    'google-disconnect': async b => busy(b, async () => {
      if (!confirm('disconnect google? things already imported stay.')) return;
      try { await api('DELETE', '/integrations/google'); } catch (err) { showError($('#card-google'), err); }
      renderIntegrations();
    }),
    'canvas-sync': async b => busy(b, async () => {
      try { await api('POST', '/integrations/canvas/sync'); showError($('#card-canvas'), null); } catch (err) { showError($('#card-canvas'), err); }
      renderIntegrations();
    }),
    'canvas-disconnect': async b => busy(b, async () => {
      if (!confirm('disconnect canvas? things already imported stay.')) return;
      try { await api('DELETE', '/integrations/canvas'); } catch (err) { showError($('#card-canvas'), err); }
      renderIntegrations();
    }),
    'tune-save': async b => busy(b, async () => {
      const t = $('#tune');
      try {
        await api('PATCH', '/users/preferences', {
          strictness: Number($('input[name=strictness]', t).value),
          quiet_hours: { start: $('input[name=quiet_start]', t).value || '23:00', end: $('input[name=quiet_end]', t).value || '08:00' },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
        await ensurePresets();
        show('apps');
      } catch (err) { showError(t, err); }
    }),
    signout: async () => signOut(),
  };

  async function submitCanvas(e) {
    e.preventDefault();
    const form = e.currentTarget, card = $('#card-canvas');
    showError(card, null);
    await busy($('button[type=submit]', form), async () => {
      try {
        const out = await api('POST', '/integrations/canvas', { base_url: form.base_url.value, token: form.token.value });
        form.token.value = '';
        const s = out.sync;
        if (s && s.status !== 'ok') showError(card, new Error(s.error || 'connected, but the first sync failed.'));
        await renderIntegrations();
      } catch (err) { showError(card, err); }
    });
  }

  async function submitIcs(e) {
    e.preventDefault();
    const form = e.currentTarget, ok = $('.ok', form);
    showError(form, null); ok.hidden = true;
    await busy($('button[type=submit]', form), async () => {
      try {
        const out = await api('POST', '/calendars', { url: form.url.value.trim() });
        form.url.value = '';
        const imp = out.import || {};
        ok.textContent = imp.status === 'ok' ? `added. ${imp.parsed ?? 0} events in the next month.` : `added, but the first import failed: ${imp.error}`;
        ok.hidden = false;
      } catch (err) { showError(form, err); }
    });
  }

  // ------------------------------------------------------------------ tune
  function strictnessNote(v) {
    return v < 0.3 ? 'one nudge a day, softly.' : v < 0.7 ? 'a few nudges a day, direct.' : 'as many as it takes. no softeners.';
  }

  async function loadPrefs() {
    const t = $('#tune');
    $('#tz').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    try {
      const p = await api('GET', '/users/preferences');
      $('input[name=strictness]', t).value = p.strictness;
      if (p.quiet_hours) { $('input[name=quiet_start]', t).value = p.quiet_hours.start; $('input[name=quiet_end]', t).value = p.quiet_hours.end; }
    } catch { /* defaults are fine */ }
    $('#strictness-note').textContent = strictnessNote(Number($('input[name=strictness]', t).value));
  }

  // ------------------------------------------------------------------ boot
  document.addEventListener('click', e => {
    const target = e.target.closest('button');
    if (!target) return;
    if (target.dataset.mode) setMode(target.dataset.mode);
    if (target.dataset.go) show(target.dataset.go);
    if (target.dataset.act && actions[target.dataset.act]) actions[target.dataset.act](target);
  });
  $('#account-form').addEventListener('submit', submitAccount);
  $('#canvas-form').addEventListener('submit', submitCanvas);
  $('#ics-form').addEventListener('submit', submitIcs);
  $('input[name=strictness]').addEventListener('input', e => { $('#strictness-note').textContent = strictnessNote(Number(e.target.value)); });
  setMode('signup');

  const hash = new URLSearchParams(location.hash.slice(1));
  const back = hash.get('google');
  if (back) history.replaceState(null, '', location.pathname);
  show(back ? 'connect' : (store.get('step') || 'account'));
  if (back === 'connected') pollUntilSynced('google');
  if (back === 'denied') showError($('#card-google'), new Error('google access was not granted. you can try again, or skip it.'));
  if (back === 'error') showError($('#card-google'), new Error('google sign-in failed. try again in a minute.'));
})();
