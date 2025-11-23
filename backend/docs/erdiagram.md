# Users Table and Key

```mermaid
erDiagram

    PostgreSQL:::postgres_

    USERS:::postgres_ {
        uuid id PK
        string phone_number UK "NOT NULL"
        string password_hash "NOT NULL"
        string email UK
        string username UK
        boolean is_active "DEFAULT TRUE"
        Date created_at "DEFAULT NOW()"
        Date updated_at "DEFAULT NOW() + TRIGGER"
        string display_name
        string nickname
    }

    DynamoDB:::dynamodb_

    classDef postgres fill:#8334
    classDef dynamodb fill:#3384
    classDef postgres_ fill:#833
    classDef dynamodb_ fill:#338
```
# Activity and Obligations ER Diagram

```mermaid
erDiagram
    USERS:::postgres

    OBLIGATIONS:::postgres_ {
        uuid id PK
        uuid user_id FK "REFERENCES users(id)"
        string title "NOT NULL"
        string description
        log_type created_by "DEFAULT 'user'"
        boolean completed "DEFAULT FALSE"
        datetime completed_at
        boolean archived "DEFAULT FALSE"
        datetime created_at "DEFAULT NOW()"
        datetime updated_at "DEFAULT NOW() + TRIGGER"
    }

    DEADLINED_OBLIGATIONS:::postgres_ {
        uuid id PK, FK "REFERENCES obligations(id)"
        datetime deadline
        float intervention_level "DEFAULT 0.5"
        boolean completed "DEFAULT FALSE"
        datetime completed_at
    }

    EVENTS:::postgres_ {
        uuid id PK, FK "REFERENCES obligations(id)"
        datetime start_time "NOT NULL"
        datetime end_time
        uuid location_id "REFERENCES locations(id)"
        boolean all_day "DEFAULT FALSE"
    }

    TASKS:::postgres_ {
        uuid id PK, FK "REFERENCES obligations(id)"
        datetime due_date
        int estimated_minutes
    }

    TIME_ALLOCATION_GOALS:::postgres_ {
        uuid id PK, FK "REFERENCES users(id)"
        uuid activity_id FK "REFERENCES activities(id)"
        float strictness "DEFAULT 0.5"
        int target_minutes
        int timeframe_days "1 = one day, 7 = one week"
    }

    MESSAGES:::dynamodb_ {
        uuid id PK
        uuid user_id FK
        boolean is_user
        string content
        datetime timestamp
    }

    MESSAGE_HISTORIES:::dynamodb_ {
        uuid id PK
        uuid message_id FK
        string action "delivered, seen, responded"
        datetime timestamp
    }

    ACTIVITIES:::postgres_ {
        uuid id PK
        uuid user_id FK "REFERENCES users(id)"
        string name
        string description
        string image
        string color
        datetime created_at "DEFAULT NOW()"
        datetime updated_at "DEFAULT NOW() + TRIGGER"
    }

    ACTIVITY_ENTRIES:::postgres_ {
        uuid id PK
        uuid user_id FK "REFERENCES users(id)"
        uuid activity_id FK "REFERENECS activities(id)"
        datetime start_time "NOT NULL"
        datetime end_time
        string note
        log_type logged_by "NOT NULL"
        log_type ended_by "user, system, trigger"
        float confidence_score
        int duration_minutes "GENERATED .. STORED"
    }

    USERS ||--o{ OBLIGATIONS : "owns"
    USERS ||--o{ ACTIVITIES : "owns"
    ACTIVITIES ||--o{ TIME_ALLOCATION_GOALS : "used_in"
    ACTIVITIES ||--o{ ACTIVITY_ENTRIES : "tracks"
    OBLIGATIONS ||--o| DEADLINED_OBLIGATIONS : "extends"
    OBLIGATIONS ||--o| TIME_ALLOCATION_GOALS : "extends"
    DEADLINED_OBLIGATIONS ||--o| EVENTS : "extends"
    DEADLINED_OBLIGATIONS ||--o| TASKS : "extends"
    USERS ||--o{ MESSAGES : "has"
    %%MESSAGES ||--o| NOTIFICATIONS : "extends"
    %%NOTIFICATIONS ||--o| RECURRING_NOTIFICATIONS : "extends"
    %%NOTIFICATIONS }o--|| NOTIFICATION_TYPES : "used_by"
    MESSAGES ||--o{ MESSAGE_HISTORIES : "has"
    
    classDef postgres fill:#8334
    classDef dynamodb fill:#3384
    classDef postgres_ fill:#833
    classDef dynamodb_ fill:#338
```

# User Preferences & Integrations ER Diagram

```mermaid
erDiagram

%%    USER_CONTEXT {
%%        uuid id PK
%%        uuid user_id FK
%%        datetime timestamp
%%        string context_data
%%    }

    USERS:::postgres

    USER_PREFERENCES:::dynamodb_ {
        uuid user_id PK, FK
        string language
        string timezone
        float strictness
        float intervention_level
    }

    SERVICES:::dynamodb_ {
        uuid id PK
        string name
        string description
        string auth_type "oauth, api_key, refresh_token"
        string base_url
        string icon_url
    }

    INTEGRATIONS:::dynamodb_ {
        uuid user_id PK, FK
        uuid service_id PK, FK
        string access_token
        string refresh_token
        datetime last_synced
        string sync_settings
    }

    LOCATIONS:::postgres {
        uuid id PK
        uuid user_id FK "REFERENCES users(id)"
        string name
        float latitude "NOT NULL"
        float longitude "NOT NULL"
        int radius "NOT NULL"
        boolean archived "DEFAULT FALSE"
        datetime created_at "DEFAULT NOW()"
        datetime updated_at "DEFAULT NOW() + TRIGGER"
    }

    LOCATION_TRIGGERS:::dynamodb

    DEVICES:::dynamodb_ {
        uuid id PK
        uuid user_id FK
        string device_token
        string device_type "ios, macos"
        datetime last_active
    }

    CHATBOTS:::dynamodb_ {
        uuid id PK
        uuid user_id FK
        string nickname
    }

    CHATBOT_SPEAKING_STYLE_WEIGHTS:::dynamodb_ {
        uuid chatbot_id PK, FK
        uuid speaking_style_id PK, FK
        float weight 
    }

    SPEAKING_STYLES:::dynamodb_ {
        uuid id PK
        string name
        string description "for developers"
    }
    
    USERS ||--o{ INTEGRATIONS : "owns"
    USERS ||--|| USER_PREFERENCES : "owns"
    USERS ||--o{ DEVICES : "owns"
    SERVICES }o--|| INTEGRATIONS : "used_by"

    USERS ||--o{ LOCATIONS : "owns"
    USERS ||--|| CHATBOTS : "has"

    CHATBOTS ||--o{ CHATBOT_SPEAKING_STYLE_WEIGHTS : "has"
    SPEAKING_STYLES }o--|| CHATBOT_SPEAKING_STYLE_WEIGHTS : "used_by"

    LOCATION_TRIGGERS }o--|| LOCATIONS : "uses"

    classDef postgres fill:#8334
    classDef dynamodb fill:#3384
    classDef postgres_ fill:#833
    classDef dynamodb_ fill:#338
```
# Triggers ER Diagram

```mermaid
erDiagram

    LOCATIONS:::postgres
    USERS:::postgres

    TRIGGERS:::dynamodb_ {
        uuid id PK
        uuid user_id FK
        json action_json
    }

    SCHEDULED_TRIGGERS:::dynamodb_ {
        uuid trigger_id PK, FK
        datetime scheduled_at
        json recurrence_rule "{interval: '7', unit: 'd'}"
        boolean enabled "separate from triggers table so that they can be turned off individually"
    }

    %% include user_id beacuse it makes the query faster since its based on sync updates.
    LOCATION_TRIGGERS:::dynamodb {
        uuid trigger_id PK, FK
        uuid location_id FK
        string event_type "enter/exit/both"
        boolean enabled
    }

    APP_USAGE_TRIGGERS:::dynamodb_ {
        uuid trigger_id PK, FK
        uuid user_id FK
        string enabled_bundle_id "${enabled}#${bundle_Id}"
        json precondition "included to reduce duplicate triggers"
    }

    HEALTH_TRIGGERS:::dynamodb_ {
        uuid trigger_id PK, FK
        uuid user_id FK 
        string enabled_event_type "${enabled}#${event_type}"
    }

    %%USERS ||--o{ ACTIONS : "owns"
    %%USERS ||--o{ CONDITIONS : "owns"
    USERS ||--o{ TRIGGERS : "owns"

    %%ACTIONS ||--o{ TRIGGERS : "used_by"
    %%CONDITIONS ||--o{ TRIGGERS : "used_by"
    LOCATIONS ||--o{ LOCATION_TRIGGERS : "used_by"

    TRIGGERS ||--o| LOCATION_TRIGGERS : "extends"
    TRIGGERS ||--o| APP_USAGE_TRIGGERS : "extends"
    TRIGGERS ||--o| SCHEDULED_TRIGGERS : "extends"
    TRIGGERS ||--o| HEALTH_TRIGGERS : "extends"

    %%CONDITIONS ||--o| NESTED_CONDITIONS : "extends"
    %%NESTED_CONDITIONS ||--o| NESTED_CONDITIONS : "uses"


    classDef postgres fill:#8334
    classDef dynamodb fill:#3384
    classDef postgres_ fill:#833
    classDef dynamodb_ fill:#338
```