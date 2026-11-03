// src/routes/integrations.ts
//
// Connected accounts. Google is an OAuth redirect (start -> Google -> callback);
// Canvas is a pasted personal access token. Either way the first sync runs
// immediately so the user sees their week fill in while still on the screen.
import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { parseOr400, serverError } from '../lib/http.js';
import { signOAuthState, verifyOAuthState } from '../lib/jwt.js';
import { sealJson, tokenKeyConfigured, unsealJson } from '../lib/secretBox.js';
import { log } from '../lib/log.js';
import { IntegrationProvider, Integrations, toPublic } from '../services/integrations/store.js';
import { syncIntegration } from '../services/integrations/index.js';
import { IntegrationAuthError } from '../services/integrations/http.js';
import * as google from '../services/integrations/google.js';
import * as canvas from '../services/integrations/canvas.js';

const router = Router();

function notConfigured(res: Response, what: string) {
  return res.status(503).json({ error: 'IntegrationNotConfigured', message: `${what} is not set up on this server.` });
}

// GET /integrations - what is connected, and what this server can connect
router.get('/integrations', authMiddleware, async (req, res) => {
  try {
    const rows = await Integrations.list(req.uid!);
    res.json({
      integrations: rows.map(toPublic),
      available: { google: google.googleConfigured(), canvas: tokenKeyConfigured() },
    });
  } catch (err) { serverError(res, err, 'listing integrations'); }
});

// POST /integrations/google/start { return?: 'setup' | 'app' } -> { url }
router.post('/integrations/google/start', authMiddleware, (req, res) => {
  if (!google.googleConfigured()) return notConfigured(res, 'Google sign-in');
  const ret = req.body?.return === 'setup' ? 'setup' : 'app';
  res.json({ url: google.authUrl(signOAuthState({ user_id: req.uid!, provider: 'google', ret })) });
});

function finishPage(res: Response, ok: boolean, message: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  res.status(ok ? 200 : 400).type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jiko</title><style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#1d1d1f;background:#fafaf7}
@media (prefers-color-scheme:dark){body{color:#f2f2ee;background:#161615}}h1{font-size:1.4rem}</style></head>
<body><h1>${ok ? 'Connected.' : 'That did not work.'}</h1><p>${esc(message)}</p><p>You can close this tab and go back to Jiko.</p></body></html>`);
}

// GET /integrations/google/callback?code&state - Google redirects the browser here
router.get('/integrations/google/callback', async (req, res) => {
  const state = verifyOAuthState(String(req.query.state ?? ''));
  if (!state) return finishPage(res, false, 'The sign-in link expired. Start again from Jiko.');
  const back = (q: string) => res.redirect(`/setup#${q}`);
  if (req.query.error) {
    const msg = req.query.error === 'access_denied' ? 'Google access was not granted.' : `Google said: ${String(req.query.error)}`;
    return state.ret === 'setup' ? back(`google=denied`) : finishPage(res, false, msg);
  }
  try {
    const tokens = await google.exchangeCode(String(req.query.code ?? ''));
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token');
    const scopes = (tokens.scope ?? '').split(' ').filter(Boolean);
    const row = await Integrations.connect(state.user_id, 'google', {
      account: google.emailFromIdToken(tokens.id_token),
      scopes,
      secret_enc: sealJson({ refresh_token: tokens.refresh_token }),
      access_token_enc: sealJson({ access_token: tokens.access_token }),
      access_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
      refresh_minutes: 30,
    });
    // first sync in the background; the page does not wait on Gmail
    void syncIntegration(row).catch(err => log.fail('first google sync failed', err, { event: 'integration_sync', user_id: state.user_id }));
    const missing = [google.SCOPE_GMAIL, google.SCOPE_CALENDAR].filter(s => !scopes.includes(s));
    const note = missing.length ? ` (without ${missing.map(s => s.includes('gmail') ? 'Gmail' : 'Calendar').join(' and ')}: that box was unticked)` : '';
    if (state.ret === 'setup') return back(`google=connected`);
    return finishPage(res, true, `Google${row.account ? ` (${row.account})` : ''} is connected${note}. Jiko is reading your calendar and recent mail now.`);
  } catch (err) {
    log.fail('google connect failed', err, { event: 'integration_connect', user_id: state.user_id });
    return state.ret === 'setup' ? back('google=error') : finishPage(res, false, 'Google sign-in failed. Try again in a minute.');
  }
});

const CanvasConnect = z.object({
  base_url: z.string().min(4).max(300),
  token: z.string().min(10).max(500),
});

// POST /integrations/canvas { base_url, token }
router.post('/integrations/canvas', authMiddleware, async (req, res) => {
  try {
    if (!tokenKeyConfigured()) return notConfigured(res, 'Storing connected accounts');
    const body = parseOr400(res, CanvasConnect, req.body); if (!body) return;
    const url = canvas.normalizeCanvasUrl(body.base_url);
    if (!url.ok) return res.status(400).json({ error: 'InvalidBody', message: url.reason });
    let who: { id: number; name: string };
    try { who = await canvas.verifyCanvas(url.url, body.token.trim()); }
    catch (err) {
      const message = err instanceof IntegrationAuthError
        ? 'Canvas rejected that token. Check it was copied whole and has not expired.'
        : `Could not reach Canvas at ${url.url}. Check the address.`;
      return res.status(400).json({ error: 'CanvasRejected', message });
    }
    const row = await Integrations.connect(req.uid!, 'canvas', {
      account: who.name, base_url: url.url, secret_enc: sealJson({ token: body.token.trim() }), refresh_minutes: 60,
    });
    const sync = await syncIntegration(row);
    res.status(201).json({ integration: toPublic((await Integrations.get(req.uid!, 'canvas')) ?? row), sync });
  } catch (err) { serverError(res, err, 'connecting Canvas'); }
});

// POST /integrations/:provider/sync - sync now, ignoring the refresh period
router.post('/integrations/:provider/sync', authMiddleware, async (req, res) => {
  try {
    const provider = IntegrationProvider.safeParse(req.params.provider);
    if (!provider.success) return res.status(404).json({ error: 'NotFound', message: 'Unknown provider' });
    const row = await Integrations.get(req.uid!, provider.data);
    if (!row) return res.status(404).json({ error: 'NotFound', message: 'Not connected' });
    const sync = await syncIntegration(row);
    res.json({ integration: toPublic((await Integrations.get(req.uid!, provider.data)) ?? row), sync });
  } catch (err) { serverError(res, err, 'syncing an integration'); }
});

// DELETE /integrations/:provider - disconnect; imported obligations stay, they were real
router.delete('/integrations/:provider', authMiddleware, async (req, res) => {
  try {
    const provider = IntegrationProvider.safeParse(req.params.provider);
    if (!provider.success) return res.status(404).json({ error: 'NotFound', message: 'Unknown provider' });
    const row = await Integrations.delete(req.uid!, provider.data);
    if (!row) return res.status(404).json({ error: 'NotFound', message: 'Not connected' });
    if (row.provider === 'google') {
      try { await google.revokeToken(unsealJson<{ refresh_token: string }>(row.secret_enc).refresh_token); } catch { /* best effort */ }
    }
    res.status(204).end();
  } catch (err) { serverError(res, err, 'disconnecting an integration'); }
});

export default router;
