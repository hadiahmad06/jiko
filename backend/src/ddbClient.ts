import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-2'; // choose your region

let ddbClient: DynamoDBClient | undefined;
let ddbDocClient: DynamoDBDocumentClient | undefined;

// Create the low-level DynamoDB client if it doesn't exist
function getDdbClient(): DynamoDBClient {
  if (!ddbClient) {
    ddbClient = new DynamoDBClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }
  return ddbClient;
}

// Create the DynamoDB Document client if it doesn't exist
function getDdbDocClient(): DynamoDBDocumentClient {
  if (!ddbDocClient) {
    const client = getDdbClient();
    ddbDocClient = DynamoDBDocumentClient.from(getDdbClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }
  return ddbDocClient;
}


export { getDdbClient, getDdbDocClient };