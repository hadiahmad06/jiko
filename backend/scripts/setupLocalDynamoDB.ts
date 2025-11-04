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
      TableName: 'Messages',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'NotificationTypes',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'user_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'Notifications',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'type_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'MessageHistory',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'message_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'UserPreferences',
      AttributeDefinitions: [
        { AttributeName: 'user_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'user_id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'Services',
      AttributeDefinitions: [
        { AttributeName: 'name', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'name', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'EmailIntegration',
      AttributeDefinitions: [
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'service_name', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'user_id', KeyType: 'HASH' },
        { AttributeName: 'service_name', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'CalendarIntegration',
      AttributeDefinitions: [
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'service_name', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'user_id', KeyType: 'HASH' },
        { AttributeName: 'service_name', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'DeviceTokens',
      AttributeDefinitions: [
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'device_token', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'user_id', KeyType: 'HASH' },
        { AttributeName: 'device_token', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'Devices',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'Chatbots',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'nickname', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' },
        { AttributeName: 'nickname', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
    {
      TableName: 'ChatbotSpeakingStyleWeight',
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
      TableName: 'SpeakingStyles',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    } as any
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