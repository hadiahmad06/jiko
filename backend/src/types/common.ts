
export type Result<T> =
  | { success: true; value: T }
  | { success: false; code: number; details: { error: string, message: string} };