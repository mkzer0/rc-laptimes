const fs = require('fs');
const path = require('path');
const { lambdaHandler } = require('../app');
const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: jest.fn(item => item),
}));

describe('app Lambda function', () => {
  let testData;

  beforeAll(() => {
    const testDataPath = path.join(__dirname, 'data', 'sample_race_data.json');
    testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DYNAMODB_TABLE_NAME = 'TestTable';
    process.env.S3_BUCKET_NAME = 'TestBucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.WEBSITE_ENDPOINT = 'test.com';
  });

  // Right: Test GET request
  test('handles GET request successfully', async () => {
    const mockEvent = { httpMethod: 'GET' };
    const mockItems = [
      { RaceId: '1', LapTimestamp: '1234567890', RaceName: 'Test Race', TrackName: 'Test Track', DriverName: 'Test Driver', LapNumber: '1', LapTime: '60000', LapDateTime: '2023-05-01T12:00:00Z' }
    ];

    DynamoDBClient.prototype.send.mockResolvedValue({ Items: mockItems });

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(mockItems);
    expect(DynamoDBClient.prototype.send).toHaveBeenCalledWith(expect.any(ScanCommand));
  });

  // Right: Test normal operation
  test('handles POST request successfully with complete data', async () => {
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'test.json',
        fileContent: Buffer.from(JSON.stringify({
          trackName: 'Test Track',
          notes: 'Test Notes',
          data: testData
        })).toString('base64'),
      }),
    };

    S3Client.prototype.send.mockResolvedValue({});

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('File uploaded successfully');
    expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
  });

  // Boundary: Test with missing trackName
  test('handles POST request with missing trackName', async () => {
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'test.json',
        fileContent: Buffer.from(JSON.stringify({
          notes: 'Test Notes',
          data: testData
        })).toString('base64'),
      }),
    };

    S3Client.prototype.send.mockResolvedValue({});

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('File uploaded successfully');
  });

  // Boundary: Test with missing notes
  test('handles POST request with missing notes', async () => {
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'test.json',
        fileContent: Buffer.from(JSON.stringify({
          trackName: 'Test Track',
          data: testData
        })).toString('base64'),
      }),
    };

    S3Client.prototype.send.mockResolvedValue({});

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('File uploaded successfully');
  });

  // Error: Test with missing data
  test('handles POST request with missing data', async () => {
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'test.json',
        fileContent: Buffer.from(JSON.stringify({
          trackName: 'Test Track',
          notes: 'Test Notes'
        })).toString('base64'),
      }),
    };

    S3Client.prototype.send.mockResolvedValue({});

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('File uploaded successfully');
  });

  // Error: Test with invalid JSON
  test('handles POST request with invalid JSON', async () => {
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'test.json',
        fileContent: Buffer.from('Invalid JSON').toString('base64'),
      }),
    };

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
  });

  // Performance: Test with large data set
  test('handles POST request with large data set', async () => {
    const largeData = { ...testData };
    largeData.races = Array(1000).fill(testData.races[0]);

    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'large_test.json',
        fileContent: Buffer.from(JSON.stringify({
          trackName: 'Large Test Track',
          notes: 'Large Test Notes',
          data: largeData
        })).toString('base64'),
      }),
    };

    S3Client.prototype.send.mockResolvedValue({});

    const startTime = Date.now();
    const result = await lambdaHandler(mockEvent);
    const endTime = Date.now();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('File uploaded successfully');
    expect(endTime - startTime).toBeLessThan(1000); // Assuming it should process in less than 1 second
  });

  // Error: Test with unsupported HTTP method
  test('handles unsupported HTTP method', async () => {
    const mockEvent = { httpMethod: 'PUT' };

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(405);
    expect(JSON.parse(result.body).error).toBe('Method not allowed');
  });

  // Error: Test DynamoDB error on GET request
  test('handles DynamoDB error on GET request', async () => {
    const mockEvent = { httpMethod: 'GET' };

    DynamoDBClient.prototype.send.mockRejectedValue(new Error('DynamoDB Error'));

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
  });

  // Error: Test S3 error on POST request
  test('handles S3 error on POST request', async () => {
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'test.json',
        fileContent: Buffer.from(JSON.stringify({
          trackName: 'Test Track',
          notes: 'Test Notes',
          data: testData
        })).toString('base64'),
      }),
    };

    S3Client.prototype.send.mockRejectedValue(new Error('S3 Error'));

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Internal server error');
  });

  // Boundary: Test with empty data set
  test('handles POST request with empty data set', async () => {
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        fileName: 'empty_test.json',
        fileContent: Buffer.from(JSON.stringify({
          trackName: 'Empty Test Track',
          notes: 'Empty Test Notes',
          data: { races: [] }
        })).toString('base64'),
      }),
    };

    S3Client.prototype.send.mockResolvedValue({});

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('File uploaded successfully');
  });
});