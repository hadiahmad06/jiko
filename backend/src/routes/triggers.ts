import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import TriggerRepository from '../services/repositories/TriggerRepository.js';
import { TriggerCreate, TriggerUpdate, TriggerKind, MatchByKind } from '../types/trigger/Trigger.js';
import { firstRun } from '../services/triggers/schedule.js';
import { parseOr400, sendResult, serverError } from '../lib/http.js';
import { runTriggers, runOne } from '../services/triggers/engine.js';
import { buildContext } from '../services/triggers/context.js';
import AppUsageManager from '../data/AppUsageManager.js';
import HealthManager from '../data/HealthManager.js';
import LocationManager from '../data/LocationManager.js';
import { z } from 'zod';
import { TRIGGER_PRESETS, instantiatePreset } from '../services/triggers/presets.js';
import { describeFiring } from '../services/triggers/reason.js';
import MessageRepository from '../services/repositories/MessageRepository.js';
import { WRONG_LIMIT, WRONG_WINDOW_DAYS } from '../services/messaging/feedback.js';

const router = Router();

// GET /triggers?kind=&include=last_firing
// `include=last_firing` attaches { fired_at, reason, context } so a Rules list
// can say why each one last spoke up.
router.get('/triggers', authMiddleware, async (req, res) => {
  try {
    const kind = req.query.kind ? TriggerKind.safeParse(req.query.kind) : null;
    if (kind && !kind.success) return res.status(400).json({ error: 'InvalidQuery', message: 'unknown kind' });
    const triggers = await TriggerRepository.list(req.uid!, kind?.data);
    if (req.query.include !== 'last_firing') return res.json(triggers);
    const last = await TriggerRepository.lastFirings(req.uid!);
    const wrong = await MessageRepository.wrongCountsByTrigger(req.uid!, new Date(Date.now() - WRONG_WINDOW_DAYS * 86_400_000));
    res.json(triggers.map(t => {
      const firing = last[t.id];
      return {
        ...t,
        wrong_recently: wrong[t.id] ?? 0,
        wrong_limit: WRONG_LIMIT,
        last_firing: firing
          ? {
              id: firing.id,
              fired_at: firing.fired_at,
              reason: (firing.context as { reason?: string }).reason ?? describeFiring(firing.context as never),
              context: firing.context,
            }
          : null,
      };
    }));
  } catch (err) { serverError(res, err, 'listing triggers'); }
});

// GET /triggers/presets - ready-made triggers the client can offer
router.get('/triggers/presets', authMiddleware, (_req, res) => {
  res.json(TRIGGER_PRESETS.map(p => ({ id: p.id, name: p.name, description: p.description, kind: p.kind, params: p.params })));
});

// POST /triggers/presets/:id - instantiate a preset with params
router.post('/triggers/presets/:id', authMiddleware, async (req, res) => {
  try {
    const preset = TRIGGER_PRESETS.find(p => p.id === req.params.id);
    if (!preset) return res.status(404).json({ error: 'NotFound', message: 'Unknown preset' });
    const built = instantiatePreset(preset, req.body ?? {});
    if (!built.success) return res.status(400).json(built.details);
    const next = built.value.kind === 'scheduled' ? firstRun(built.value.match, new Date()) : null;
    res.status(201).json(await TriggerRepository.create(req.uid!, built.value, next));
  } catch (err) { serverError(res, err, 'creating a trigger from a preset'); }
});

// GET /triggers/firings - recent firings across all triggers
router.get('/triggers/firings', authMiddleware, async (req, res) => {
  try { res.json(await TriggerRepository.recentFiringsForUser(req.uid!, Math.min(200, Number(req.query.limit) || 50))); }
  catch (err) { serverError(res, err, 'listing firings'); }
});

// POST /triggers
router.post('/triggers', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, TriggerCreate, req.body); if (!body) return;
    const next = body.kind === 'scheduled' ? firstRun(body.match, new Date()) : null;
    res.status(201).json(await TriggerRepository.create(req.uid!, body, next));
  } catch (err) { serverError(res, err, 'creating a trigger'); }
});

// GET /triggers/:id
router.get('/triggers/:id', authMiddleware, async (req, res) => {
  try { sendResult(res, await TriggerRepository.get(req.params.id as string, req.uid!)); }
  catch (err) { serverError(res, err, 'fetching a trigger'); }
});

// PATCH /triggers/:id
router.patch('/triggers/:id', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, TriggerUpdate, req.body); if (!body) return;
    const existing = await TriggerRepository.get(req.params.id as string, req.uid!);
    if (!existing.success) return sendResult(res, existing);
    const fields: Record<string, unknown> = { ...body };
    if (body.match) {
      const m = MatchByKind[existing.value.kind].safeParse(body.match);
      if (!m.success) return res.status(400).json({ error: 'InvalidBody', message: `match is invalid for kind ${existing.value.kind}`, details: m.error.issues });
      fields.match = m.data;
      if (existing.value.kind === 'scheduled') fields.next_run_at = firstRun(m.data as never, new Date());
    }
    sendResult(res, await TriggerRepository.update(req.params.id as string, req.uid!, fields));
  } catch (err) { serverError(res, err, 'updating a trigger'); }
});

// DELETE /triggers/:id
router.delete('/triggers/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await TriggerRepository.delete(req.params.id as string, req.uid!);
    if (!ok) return res.status(404).json({ error: 'NotFound', message: 'Trigger not found' });
    res.status(204).end();
  } catch (err) { serverError(res, err, 'deleting a trigger'); }
});

// GET /triggers/:id/firings
router.get('/triggers/:id/firings', authMiddleware, async (req, res) => {
  try { res.json(await TriggerRepository.firings(req.params.id as string, req.uid!)); }
  catch (err) { serverError(res, err, 'listing firings'); }
});

// POST /triggers/:id/test - evaluate now against cached state; { force: true } skips match/condition/cooldown
router.post('/triggers/:id/test', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, z.object({ force: z.boolean().default(false) }), req.body ?? {}); if (!body) return;
    const t = await TriggerRepository.get(req.params.id as string, req.uid!);
    if (!t.success) return sendResult(res, t);
    const uid = req.uid!;
    const opts = { appUsage: AppUsageManager.snapshot(uid), health: HealthManager.snapshot(uid), lastLocation: LocationManager.last(uid) };
    if (body.force) {
      const { executeActions } = await import('../services/triggers/execute.js');
      const ctx = await buildContext(uid, { kind: 'manual' }, opts);
      ctx.trigger = t.value;
      const results = await executeActions(t.value.actions, ctx);
      await TriggerRepository.recordFiring(t.value.id, uid, { event: 'manual', forced: true }, results);
      return res.json({ fired: true, forced: true, results });
    }
    const kind = t.value.kind;
    let report;
    if (kind === 'scheduled' || kind === 'obligation') {
      const ctx = await buildContext(uid, kind === 'scheduled' ? { kind: 'scheduled' } : { kind: 'manual' }, opts);
      report = await runOne({ ...t.value, next_run_at: new Date(0) } as typeof t.value, ctx);
    } else {
      const last = AppUsageManager.snapshot(uid)[0];
      const event = kind === 'app_usage' && last ? { kind: 'app_usage' as const, data: last, allDevices: AppUsageManager.snapshot(uid) }
        : kind === 'health' && HealthManager.snapshot(uid)[0] ? { kind: 'health' as const, data: HealthManager.snapshot(uid)[0]!, allDevices: HealthManager.snapshot(uid) }
        : kind === 'location' && LocationManager.last(uid) ? { kind: 'location' as const, previous: null, current: LocationManager.last(uid)! }
        : null;
      if (!event) return res.json({ fired: false, reason: `no cached ${kind} data to evaluate against; sync first or use force` });
      const reports = await runTriggers(uid, event, opts);
      report = reports.find(r => r.trigger_id === t.value.id) ?? null;
    }
    res.json(report ? { fired: true, ...report } : { fired: false, reason: 'match, cooldown, or condition did not pass' });
  } catch (err) { serverError(res, err, 'testing a trigger'); }
});

export default router;
