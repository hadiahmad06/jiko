// src/services/triggers/execute.ts

import ActivityManager from "data/ActivityManager";

export async function executeActions(user_id: string, action_json: any) {
  for (const action of action_json) {
    await executeAction(user_id, action);
  }
}

async function executeAction(user_id: string, action: any) {
  // Input validation: check that action_json and condition_json are objects with expected structure
  function isValidAction(obj: any): boolean {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      'params' in obj
    );
  }

  if (!isValidAction(action)) {
    console.error('Invalid action_json: must be an object with "type" and "params" keys.');
    return;
  }

  // Inject user_id into action_json.params.user_id
  if (action.params && typeof action.params === 'object') {
    action.params.user_id = user_id;
  }

  // implementation for executing any trigger's action_json

  let result: string = "";
  const now = new Date();

  switch (action.type) {
    case 'notify_user':
      console.log(`Notifying user ${user_id} with message: ${action.params.message}`);
      // Implement notification logic here (e.g., send email, push notification, etc.)
      break;
    
    case 'start_activity':
      // Implement activity start logic here
      let res = await ActivityManager.addEntry({
        id: crypto.randomUUID(),
        user_id: user_id,
        activity_id: action.params.activity_id,
        start_time: now,
        created_at: now,
        updated_at: now,
        logged_by: "trigger"
      });

      result = res ? "success" : "failure";
      break;

    case 'stop_activity':
      console.log(`Stopping activity ${action.params.activity_id} for user ${user_id}`);
      // Implement activity stop logic here
      res = await ActivityManager.updateEntry({
        id: crypto.randomUUID(),
        user_id: user_id,
        end_time: now,
        logged_by: "trigger"
      });

      result = res ? "success" : "failure";
      break;

    default:
      console.error(`Unknown action type: ${action.type}`);
  }

  // Handle nested actions in closure if present
  if (action.closure) {
    const closure = action.closure;
    if (closure[result] && Array.isArray(closure[result])) {
      executeActions(user_id, closure[result]);
    }
  }
}

// Example usage:
// Nested action_json
// assume that this action is triggered by location, app usage, or other trigger
/*

const action_json = {
  [
    type: "start_activity",
    params: {
      user_id: 42, // injected at runtime
      activity_id: "id-for-gym-activity",
      closure: {
        "success": [
          {
            type: "stop_activity",
            params: {
              user_id: 42, // injected at runtime
              activity_id: "id-for-walking-activity",
            }
          },
          {
            type: "stop_activity",
            params: {
              user_id: 42, // injected at runtime
              activity_id: "id-for-cycling-activity",
            }
          },
          {
            type: "stop_activity",
            params: {
              user_id: 42, // injected at runtime
              activity_id: "id-for-commuting-activity",
            }
          }
        ],
        "failure": [
          {
            type: "notify_user",
            params: {
              user_id: 42, // injected at runtime
              message: "Could not start activity",
            }
          }
        ]
      }
    }
    condition: {
      type: "within_geofence",
      params: {
        user_id: 42, // injected at runtime
        latitude: 44.97399,
        longitude: -93.22773,
        radius_meters: 100
      }
    }
  ]
};

executeAction(user_id, action_json);
*/