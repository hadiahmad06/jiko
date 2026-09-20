// src/middleware/requestLog.ts
// One line per request, with the authenticated user when there is one, so
// "why did nothing fire for me at 3pm?" can be answered from logs.
import { NextFunction, Request, Response } from 'express';
import { log } from '../lib/log.js';

export function requestLog(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const fields = {
      event: 'request',
      method: req.method,
      // req.route is only set once a handler matched; path keeps ids out of
      // the log line's cardinality where possible.
      path: req.route?.path ?? req.path,
      status: res.statusCode,
      ms: Math.round(ms),
      user_id: req.uid,
    };
    if (res.statusCode >= 500) log.error('request failed', fields);
    else if (res.statusCode >= 400) log.warn('request rejected', fields);
    else log.info('request', fields);
  });
  next();
}
