import { z } from 'zod';

// define Zod enum for platforms
export const PlatformSchema = z.enum(["ios", "macos", "windows", "android", "linux", "web"]);

// TypeScript type inferred from schema
export type Platform = z.infer<typeof PlatformSchema>;