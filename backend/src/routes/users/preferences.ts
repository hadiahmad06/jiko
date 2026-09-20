import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import PreferencesRepository from '../../services/repositories/PreferencesRepository.js';
import { UserPreferencesUpdate, budgetForStrictness } from '../../types/user/UserPreferences.js';
import { parseOr400, serverError } from '../../lib/http.js';
import { budgetStatus } from '../../services/messaging/outbox.js';
import { z } from 'zod';

const router = Router();

router.get('/users/preferences', authMiddleware, async (req, res) => {
  try {
    const prefs = await PreferencesRepository.get(req.uid!);
    res.json({ ...prefs, budget: await budgetStatus(req.uid!) });
  } catch (err) { serverError(res, err, 'fetching preferences'); }
});

// PATCH /users/preferences - setting strictness without a budget derives one
router.patch('/users/preferences', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, UserPreferencesUpdate, req.body); if (!body) return;
    if (body.strictness !== undefined && body.interrupt_budget_per_day === undefined) {
      body.interrupt_budget_per_day = budgetForStrictness(body.strictness);
    }
    res.json(await PreferencesRepository.update(req.uid!, body));
  } catch (err) { serverError(res, err, 'updating preferences'); }
});

// PUT /users/quiet { active, minutes?, reason? }
// A device reports a Focus or a manual pause. The window is a lease: send it
// again while the Focus lasts, or `{ active: false }` to end it early.
router.put('/users/quiet', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, z.object({
      active: z.boolean(),
      minutes: z.number().int().min(1).max(24 * 60).default(10),
      reason: z.string().max(120).optional(),
    }), req.body); if (!body) return;
    const prefs = await PreferencesRepository.setQuiet(req.uid!, {
      minutes: body.active ? body.minutes : null,
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
    res.json({ quiet_until: prefs.quiet_until, quiet_reason: prefs.quiet_reason });
  } catch (err) { serverError(res, err, 'setting quiet mode'); }
});

router.delete('/users/preferences', authMiddleware, async (req, res) => {
  try { res.json(await PreferencesRepository.reset(req.uid!)); }
  catch (err) { serverError(res, err, 'resetting preferences'); }
});

export default router;
