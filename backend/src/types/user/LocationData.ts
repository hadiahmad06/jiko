import { Platform } from "../device/Platform";
import z from "zod";

// Location data schema
export const LocationData = z.object({
  timestamp: z.string(),     // ISO timestamp
  platform: Platform,
  device_id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  altitude: z.number().optional(),
});

export type LocationDataT = z.infer<typeof LocationData>;

// Location queue to store previous N synced locations
export class LocationQueue {
  private locations: LocationDataT[] = [];
  private maxSize: number;

  constructor(maxSize: number = 3) {
    this.maxSize = maxSize;
  }

  push(location: LocationDataT): void {
    this.locations.push(location);
    if (this.locations.length > this.maxSize) {
      this.locations.shift(); // Remove oldest location
    }
  }

  getAll(): LocationDataT[] {
    return [...this.locations];
  }

  getSize(): number {
    return this.locations.length;
  }

  isEmpty(): boolean {
    return this.locations.length === 0;
  }
}