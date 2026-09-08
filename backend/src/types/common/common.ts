export type Result<T> =
  | { success: true; value: T }
  | { success: false; code: number; details: { error: string; message: string } };

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function fail<T = never>(code: number, error: string, message: string): Result<T> {
  return { success: false, code, details: { error, message } };
}

export function notFound<T = never>(message = 'Not found'): Result<T> {
  return fail<T>(404, 'NotFound', message);
}

export function mergeArray<T>(
  oldArr: T[] | undefined,
  newArr: T[],
  getTimestamp?: (item: T) => string | number,
  maxEntries = 100,
  maxAgeSec = 60 * 60
): T[] {
  if (!oldArr) return newArr;
  const combined = [...(oldArr || []), ...newArr];
  if (getTimestamp) {
    combined.sort((a, b) => new Date(getTimestamp(a)).getTime() - new Date(getTimestamp(b)).getTime());
  }
  const now = Date.now();
  const filtered = maxAgeSec && getTimestamp
    ? combined.filter(item => now - new Date(getTimestamp(item)).getTime() <= maxAgeSec * 1000)
    : combined;
  return filtered.slice(-maxEntries);
}
