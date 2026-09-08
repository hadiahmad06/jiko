// src/services/messaging/template.ts
// Tiny mustache: {{key}} replaced from a flat map; unknown keys become "".
export function renderTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  }).replace(/[ \t]{2,}/g, ' ').trim();
}
