import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import UsageRepository from '../services/repositories/UsageRepository.js';
import { AppLabelSet, UsageSummaryQuery } from '../types/usage/Usage.js';
import { buildDailySummary, formatDailySummary } from '../services/summary.js';
import PreferencesRepository from '../services/repositories/PreferencesRepository.js';
import { parseOr400, serverError } from '../lib/http.js';

const router = Router();

// GET /usage/summary?days_ago=0
router.get('/usage/summary', authMiddleware, async (req, res) => {
  try {
    const q = parseOr400(res, UsageSummaryQuery, req.query, 'Query'); if (!q) return;
    const summary = await buildDailySummary(req.uid!, q.days_ago);
    const prefs = await PreferencesRepository.get(req.uid!);
    res.json({ ...summary, text: formatDailySummary(summary, prefs.strictness) });
  } catch (err) { serverError(res, err, 'building the usage summary'); }
});

// GET /usage/apps - apps seen with their labels
router.get('/usage/apps', authMiddleware, async (req, res) => {
  try { res.json(await UsageRepository.seenApps(req.uid!)); }
  catch (err) { serverError(res, err, 'listing apps'); }
});

// PUT /usage/apps/labels { labels: [{bundle_id, label}] }
router.put('/usage/apps/labels', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, AppLabelSet, req.body); if (!body) return;
    await UsageRepository.setLabels(req.uid!, body.labels);
    res.json(await UsageRepository.labels(req.uid!));
  } catch (err) { serverError(res, err, 'setting app labels'); }
});

export default router;
