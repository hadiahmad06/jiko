import { z } from 'zod';

export const Platform = z.enum(["ios", "macos", "windows", "android", "linux", "web"]);

export type PlatformT = z.infer<typeof Platform>;