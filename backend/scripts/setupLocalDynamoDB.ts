import Docker from 'dockerode';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';

const docker = new Docker();
const LOCAL_PORT = 8000;

async function startDynamo() {
  const containers = await docker.listContainers({ all: true });
  const existing = containers.find(c => c.Names.includes('/dynamodb-local'));

  if (!existing) {
    console.log('Starting local DynamoDB container...');
    await docker.createContainer({
      Image: 'amazon/dynamodb-local',
      name: 'dynamodb-local',
      HostConfig: {
        PortBindings: { '8000/tcp': [{ HostPort: LOCAL_PORT.toString() }] },
      },
    }).then(c => c.start());
  } else {
    console.log('DynamoDB container already exists, starting if stopped...');
    const container = docker.getContainer('dynamodb-local');
    await container.start().catch(() => {});
  }

  console.log('Waiting a few seconds for DynamoDB to initialize...');
  await new Promise(res => setTimeout(res, 3000));
}

const client = new DynamoDBClient({
  region: 'local',
  endpoint: `http://localhost:${LOCAL_PORT}`,
  credentials: {
    accessKeyId: 'fakeAccessKeyId',
    secretAccessKey: 'fakeSecretAccessKey',
  },
});

async function createTables() {
  const tables = [
    {
      TableName: 'MESSAGES',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'user-id-index',
          KeySchema: [
            { AttributeName: 'user_id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    {
      TableName: 'MESSAGE_HISTORIES',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'message_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'message-id-index',
          KeySchema: [
            { AttributeName: 'message_id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    {
      TableName: 'USER_PREFERENCES',
      AttributeDefinitions: [
        { AttributeName: 'user_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'user_id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'SERVICES',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'INTEGRATIONS',
      AttributeDefinitions: [
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'service_id', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'user_id', KeyType: 'HASH' },
        { AttributeName: 'service_id', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'DEVICES',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'user-id-index',
          KeySchema: [
            { AttributeName: 'user_id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    {
      TableName: 'CHATBOTS',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'user-id-index',
          KeySchema: [
            { AttributeName: 'user_id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    {
      TableName: 'CHATBOT_SPEAKING_STYLE_WEIGHTS',
      AttributeDefinitions: [
        { AttributeName: 'chatbot_id', AttributeType: 'S' },
        { AttributeName: 'speaking_style_id', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'chatbot_id', KeyType: 'HASH' },
        { AttributeName: 'speaking_style_id', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'SPEAKING_STYLES',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    } as any,
    // TRIGGERS table
    {
      TableName: 'TRIGGERS',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'user-id-index',
          KeySchema: [
            { AttributeName: 'user_id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    // SCHEDULED_TRIGGERS table
    {
      TableName: 'SCHEDULED_TRIGGERS',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'scheduled_at', AttributeType: 'S' },
        { AttributeName: 'enabled', AttributeType: 'B' }
      ],
      KeySchema: [
        { AttributeName: 'enabled', KeyType: 'HASH' },
        { AttributeName: 'scheduled_at', KeyType: 'RANGE' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'id-index',
          KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'user-id-index',
          KeySchema: [
            { AttributeName: 'user_id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    // LOCATION_TRIGGERS table
    {
      TableName: 'LOCATION_TRIGGERS',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'location_id', AttributeType: 'S' },
        { AttributeName: 'enabled_event_type', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'location_id', KeyType: 'HASH' },
        { AttributeName: 'enabled_event_type', KeyType: 'RANGE' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'id-index',
          KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'user-id-index',
          KeySchema: [
            { AttributeName: 'user_id', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    // APP_USAGE_TRIGGERS table
    {
      TableName: 'APP_USAGE_TRIGGERS',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'enabled_event_type', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'enabled_event_type', KeyType: 'HASH' },
        { AttributeName: 'user_id', KeyType: 'RANGE' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'id-index',
          KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    // HEALTH_TRIGGERS table
    {
      TableName: 'HEALTH_TRIGGERS',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'enabled_event_type', AttributeType: 'S' }
      ],
      KeySchema: [
        // NEEDS TO USE COMPOSITE SORT KEY: `${enabled}#${health_type}`
        { AttributeName: 'user_id', KeyType: 'HASH' },
        { AttributeName: 'enabled_event_type', KeyType: 'RANGE' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'id-index',
          KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }
  ];

  for (const t of tables) {
    try {
      await client.send(new CreateTableCommand(t));
      console.log(`Created table: ${t.TableName}`);
    } catch (err: any) {
      if (err.name === 'ResourceInUseException') {
        console.log(`Table already exists: ${t.TableName}`);
      } else {
        console.error(`Error creating table ${t.TableName}:`, err);
      }
    }
  }
}

async function main() {
  await startDynamo();
  await createTables();
  console.log('Local DynamoDB setup complete!');
}

main().catch(console.error);