import { getPsqlClient } from "db/psqlClient";
import { getDdbDocClient } from "db/ddbClient";
import ngeohash from "ngeohash";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { executeActions } from "./execute";


// Check location triggers for a given user at specified latitude and longitude
// TODO: batch processing for multiple users/locations, when needed for performance
export async function checkLocationTriggers(userLocations: { user_id: string; latitude: number; longitude: number }[]) {
  for (const loc of userLocations) {
    await checkLocationTriggersUnbatched(loc.user_id, loc.latitude, loc.longitude);
  }
}

export async function checkLocationTriggersUnbatched(user_id: string, latitude: number, longitude: number) {
  const psql = await getPsqlClient();

  // length 6: ~1.2km x 0.6km area
  const geohash = ngeohash.encode(latitude, longitude, 6);
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
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
        radius
      )
  `;
  const preciseValues = [locationIds, longitude, latitude];
  const preciseRes = await psql.query(preciseQuery, preciseValues);

  const triggeredLocationIds = preciseRes.rows.map((row) => row.id);

  const ddb = getDdbDocClient();

  let triggers: any[] = [];

  for (const locationId of triggeredLocationIds) {
    const scheduledResponse = await ddb.send(
      new QueryCommand({
        TableName: "location_triggers",
        IndexName: "enabled-index", // TODO: need to implement
        KeyConditionExpression: "enabled = :enabled AND location_id = :location_id",
        ExpressionAttributeValues: {
          ":enabled": true,
          ":location_id": locationId,
        },
      })
    );
    if (scheduledResponse.Items) {
      triggers = triggers.concat(scheduledResponse.Items);
    }
  }

  executeActions(user_id, triggers.map(t => t.action_json));
}
