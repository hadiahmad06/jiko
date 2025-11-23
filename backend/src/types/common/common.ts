
export type Result<T> =
  | { success: true; value: T }
  | { success: false; code: number; details: { error: string, message: string} };

export function mergeArray<T>(
  oldArr: T[] | undefined,
  newArr: T[],
  getTimestamp?: (item: T) => string | number,
  maxEntries = 100,
  maxAgeSec = 60 * 60 // 1 hour, for example
): T[] {
  if (!oldArr) return newArr; // * dont even worry about trimming

  // combine arrays
  const combined = [...(oldArr || []), ...newArr];

  // sort by timestamp if provided
  if (getTimestamp) {
    combined.sort((a, b) => {
      const ta = new Date(getTimestamp(a)).getTime();
      const tb = new Date(getTimestamp(b)).getTime();
      return ta - tb;
    });
  }

  // filter by max age
  const now = Date.now();
  const filtered = maxAgeSec && getTimestamp
    ? combined.filter(item => now - new Date(getTimestamp(item)).getTime() <= maxAgeSec * 1000)
    : combined;

  // enforce max length
  return filtered.slice(-maxEntries);
}

