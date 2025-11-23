import { getPsqlClient } from "../../db/psqlClient.js";
import { getDdbDocClient } from "../../db/ddbClient.js";
import ngeohash from "ngeohash";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { executeActions } from "./execute.js";
import { LocationDataT } from "../../types/user/sync/LocationData.js";


// Check location triggers for a given user at specified latitude and longitude
// TODO: batch processing for multiple users/locations, when needed for performance
export async function checkLocationTriggers(userLocations: { user_id: string; oldLocation: LocationDataT, newLocation: LocationDataT }[]) {
  for (const loc of userLocations) {
    await checkLocationTriggersUnbatched(loc.user_id, loc.oldLocation, loc.newLocation );
  }
}

export async function checkLocationTriggersUnbatched(user_id: string, oldLocation: LocationDataT, newLocation: LocationDataT) {
  const psql = await getPsqlClient();

  const { latitude: newLat, longitude: newLong, radius: newRad } = newLocation
  const { latitude: oldLat, longitude: oldLong, radius: oldRad } = oldLocation

  // --- Simple approximate overlap check ---
  // Convert radius (meters) to rough latitude/longitude degrees (~111,000m per degree)
  const toDeg = (m: number) => m / 111000;

  const approxOldRadiusDeg = toDeg(oldRad);
  const approxNewRadiusDeg = toDeg(newRad);

  // Very cheap bounding‑box style overlap check
  const latDiff = Math.abs(oldLat - newLat);
  const longDiff = Math.abs(oldLong - newLong);

  // If bounding boxes overlap, exit early (we do NOT need precise checks)
  if (
    latDiff <= approxOldRadiusDeg + approxNewRadiusDeg &&
    longDiff <= approxOldRadiusDeg + approxNewRadiusDeg
  ) {
    return [];
  }
  // --- End simple overlap check ---

  // --- Geohash to s
  // length 6: ~1.2km x 0.6km area
  const geohash = ngeohash.encode(newLat, newLong, 6);
  const neighbours = ngeohash.neighbors(geohash);
  // neighbours area: ~3.6km x 1.8km area
  const geohashesToCheck = [geohash, ...neighbours].map(g => g.slice(0, 6));
  const query = `
    SELECT id
    FROM "Locations"
    WHERE is_active = true
    AND user_id = $1
    AND LEFT(geohash, 6) = ANY($2)
  `;
  const values = [user_id, geohashesToCheck];
  const res = await psql.query(query, values);

  if (res.rows.length === 0) return [];

  const locationIds = res.rows.map((row) => row.id);

  const preciseQuery = `
    SELECT id
      FROM "Locations"
      WHERE id = ANY($1)
      AND ST_DWithin(
        geog,
        ST_SetSRID(ST_MakePoint($2, $3), 4326),
        radius
      );
  `;
  const oldPreciseRes = await psql.query(preciseQuery, [locationIds, oldLong, oldLat]);
  const newPreciseRes = await psql.query(preciseQuery, [locationIds, newLong, newLat]);

  const triggeredOldLocationIds = oldPreciseRes.rows.map((row) => row.id);
  const triggeredNewLocationIds = newPreciseRes.rows.map((row) => row.id);

  const ddb = getDdbDocClient();


  // --- Fetch triggers for locations ---

  // const prefixes = [ "true#enter"]
  let triggers: any[] = [];

  for (const locationId of triggeredOldLocationIds) {
    queryLocationTriggers(locationId, "true#exit");
    queryLocationTriggers(locationId, "true#both");
  }
  for (const locationId of triggeredNewLocationIds) {
    queryLocationTriggers(locationId, "true#exit");
    queryLocationTriggers(locationId, "true#both");
  }

  async function queryLocationTriggers(locationId: string, prefix: string) {
    const res = await ddb.send(
        new QueryCommand({
          TableName: "location_triggers",
          IndexName: "enabled-index",
          KeyConditionExpression: "location_id = :loc AND begins_with(enabled_event_type, :prefix)",
          ExpressionAttributeValues: {
            ":loc": locationId,
            ":prefix": prefix // will match "true#exit" and "true#both"
          }
        })
      );
      if (res.Items) {
        triggers = triggers.concat(res.Items);
      }
  }

  executeActions(user_id, triggers.map(t => t.action_json));
}
