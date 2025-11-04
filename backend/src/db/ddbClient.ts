import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-2';
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';

let ddbClient: DynamoDBClient | undefined;
let ddbDocClient: DynamoDBDocumentClient | undefined;

function getDdbClient(): DynamoDBClient {
  if (!ddbClient) {
    const clientConfig: any = {
      region: REGION,
    };

    if (IS_OFFLINE) {
      clientConfig.endpoint = 'http://localhost:8000'; // local docker instance
      clientConfig.credentials = {
        accessKeyId: 'fakeAccessKeyId',
        secretAccessKey: 'fakeSecretAccessKey',
      };
    } else {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      };
    }

    ddbClient = new DynamoDBClient(clientConfig);
  }
  return ddbClient;
}

function getDdbDocClient(): DynamoDBDocumentClient {
  if (!ddbDocClient) {
    ddbDocClient = DynamoDBDocumentClient.from(getDdbClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }
  return ddbDocClient;
}


export { getDdbClient, getDdbDocClient };