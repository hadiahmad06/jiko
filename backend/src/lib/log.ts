// src/lib/log.ts
//
// One JSON object per line, so three instances' logs can be grepped like a
// table: `fly logs | jq 'select(.event == "firing")'`. Pretty single-line text
// in development, where a human is reading them.
type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  event?: string | undefined;
  user_id?: string | undefined;
  trigger_id?: string | undefined;
  message_id?: string | undefined;
  /** Anything else worth grepping for. Keep it flat and small. */
  [key: string]: unknown;
}

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const name = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info')).toLowerCase();
  return LEVELS[name as Level] ?? LEVELS.info;
}

/** JSON in production, readable text anywhere else. */
function asJson(): boolean {
  return process.env.LOG_FORMAT === 'json' || (process.env.NODE_ENV === 'production' && process.env.LOG_FORMAT !== 'text');
}

function emit(level: Level, msg: string, fields: LogFields = {}) {
  if (LEVELS[level] < threshold()) return;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (asJson()) {
    sink(JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields }));
    return;
  }
  const extras = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' ');
  sink(`[${level}] ${msg}${extras ? ' ' + extras : ''}`);
}

export const log = {
  debug: (msg: string, fields?: LogFields) => emit('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
  /** Errors keep their message and stack without the caller unwrapping them. */
  fail: (msg: string, err: unknown, fields?: LogFields) =>
    emit('error', msg, { ...fields, error: (err as Error)?.message ?? String(err), stack: (err as Error)?.stack }),
};
