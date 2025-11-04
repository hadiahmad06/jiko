# Users Table and Key

```mermaid
erDiagram

    PostgreSQL:::postgres

    USERS:::postgres {
        uuid id PK
        string phone_number UK
        string password_hash
        string email UK
        string username UK
        boolean is_active
        Date created_at
        Date updated_at
        string display_name
        string nickname
    }

    DynamoDB:::dynamodb

    classDef postgres fill:#a448
    classDef dynamodb fill:#44a8
```
# Activity and Obligations ER Diagram

```mermaid
erDiagram
    USERS:::postgres

    OBLIGATIONS:::postgres {
        uuid id PK
        uuid user_id FK
        string title
        string description
        boolean completed
        datetime completed_at
        boolean archived
        datetime created_at
        datetime updated_at
    }

    DEADLINED_OBLIGATIONS:::postgres {
        uuid id PK, FK
        datetime deadline
        float intervention_level "default 0.5"
        boolean completed
        datetime completed_at
    }

    EVENTS:::postgres {
        uuid id PK, FK
        datetime start_time
        datetime end_time
        string location
        boolean all_day
    }

    TASKS:::postgres {
        uuid id PK, FK
        datetime due_date
        int estimated_minutes
    }

    TIME_ALLOCATION_GOALS:::postgres {
        uuid id PK, FK
        uuid activity_id FK
        float strictness "default 0.5"
        int target_minutes
        int timeframe_days "1 = one day, 7 = one week"
    }

    MESSAGES:::dynamodb {
        uuid id PK
        uuid user_id FK
        boolean is_user
        string content
        datetime timestamp
    }

    NOTIFICATION_TYPES:::dynamodb {
        uuid id PK
        string name
    }

    NOTIFICATIONS:::dynamodb {
        uuid id PK, FK
        uuid type_id FK
    }

    MESSAGE_HISTORY:::dynamodb {
        uuid id PK
        uuid message_id FK
        string action "delivered, seen, responded"
        datetime timestamp
    }

    ACTIVITIES:::postgres {
        uuid id PK
        uuid user_id FK
        string name
        string image
        string color
        string description
        datetime created_at
    }

    ACTIVITY_ENTRIES:::postgres {
        uuid id PK
        uuid activity_id FK
        datetime start_time
        datetime end_time
        string note
        float confidence_score
        int duration_minutes
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
    MESSAGES ||--o| NOTIFICATIONS : "extends"
    NOTIFICATIONS }o--|| NOTIFICATION_TYPES : "used_by"
    MESSAGES ||--o{ MESSAGE_HISTORY : "has"
    
    classDef postgres fill:#a448
    classDef dynamodb fill:#44a8
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

    USER_PREFERENCES:::dynamodb {
        uuid user_id PK, FK
        string strictness
        string intervention_level
        string language
        string timezone
        string other_preferences
    }

    SERVICES:::dynamodb {
        string name PK
        string description
    }

    EMAIL_INTEGRATIONS:::dynamodb {
        uuid user_id PK, FK
        string service_name PK, FK
        string integration_data
    }

    CALENDAR_INTEGRATIONS:::dynamodb {
        uuid user_id PK, FK
        string service_name PK, FK
        string integration_data
    }

    DEVICE_TOKENS:::dynamodb {
        uuid user_id PK, FK
        string device_token PK
        uuid device_type_id FK
        datetime last_active
    }

    DEVICES:::dynamodb {
        string id PK
        string name
    }

    CHATBOTS:::dynamodb {
        uuid id PK
        uuid user_id FK
        string nickname PK
    }

    CHATBOT_SPEAKING_STYLE_WEIGHT:::dynamodb {
        uuid chatbot_id PK, FK
        uuid speaking_style_id PK, FK
        float weight 
    }

    SPEAKING_STYLES:::dynamodb {
        uuid id PK
        string name
        string description "for developers"
    }
    
%%    USERS ||--o{ USER_CONTEXT : "owns"
    USERS ||--|| USER_PREFERENCES : "owns"
    USERS ||--o{ EMAIL_INTEGRATIONS : "owns"
    USERS ||--o{ CALENDAR_INTEGRATIONS : "owns"
    USERS ||--o{ DEVICE_TOKENS : "owns"
    DEVICE_TOKENS }o--|| DEVICES : "used_by"
    EMAIL_INTEGRATIONS }o--|| SERVICES : "used_by"
    CALENDAR_INTEGRATIONS }o--|| SERVICES : "used_by"

    USERS ||--|| CHATBOTS : "has"
    CHATBOTS ||--o{ CHATBOT_SPEAKING_STYLE_WEIGHT : "has"
    CHATBOT_SPEAKING_STYLE_WEIGHT }o--|| SPEAKING_STYLES : "used_in"

    classDef postgres fill:#a448
    classDef dynamodb fill:#44a8
```