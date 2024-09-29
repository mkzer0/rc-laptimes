const fs = require('fs');
const path = require('path');
const { lambdaHandler } = require('../process_data');
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');

describe('process_data Lambda function', () => {
  let testData;

  beforeAll(() => {
    const testDataPath = path.join(__dirname, 'data', 'sample_race_data.json');
    testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DYNAMODB_TABLE_NAME = 'TestTable';
    process.env.AWS_REGION = 'us-east-1';
  });

  // Right: Test normal operation
  test('successfully processes race data and stores in DynamoDB', async () => {
    const mockEvent = {
      Records: [{ s3: { bucket: { name: 'test-bucket' }, object: { key: 'test-file.json' } } }],
    };

    const mockS3Data = {
      trackName: 'Test Track',
      notes: 'Test Notes',
      data: testData
    };

    S3Client.prototype.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({ Body: { transformToString: () => Promise.resolve(JSON.stringify(mockS3Data)) } });
      }
      return Promise.resolve({});
    });

    DynamoDBClient.prototype.send.mockResolvedValue({});

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toBe('Data processed successfully and file renamed');
    expect(DynamoDBClient.prototype.send).toHaveBeenCalledWith(expect.any(PutItemCommand));
  });

  // Boundary: Test with missing trackName
  test('handles missing trackName', async () => {
    const mockEvent = {
      Records: [{ s3: { bucket: { name: 'test-bucket' }, object: { key: 'test-file.json' } } }],
    };

    const mockS3Data = {
      notes: 'Test Notes',
      data: testData
    };

    S3Client.prototype.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({ Body: { transformToString: () => Promise.resolve(JSON.stringify(mockS3Data)) } });
      }
      return Promise.resolve({});
    });

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toBe('Error processing data: TrackName is missing');
    expect(DynamoDBClient.prototype.send).not.toHaveBeenCalled();
  });

  // Boundary: Test with missing notes
  test('handles missing notes', async () => {
    const mockEvent = {
      Records: [{ s3: { bucket: { name: 'test-bucket' }, object: { key: 'test-file.json' } } }],
    };

    const mockS3Data = {
      trackName: 'Test Track',
      data: testData
    };

    S3Client.prototype.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({ Body: { transformToString: () => Promise.resolve(JSON.stringify(mockS3Data)) } });
      }
      return Promise.resolve({});
    });

    DynamoDBClient.prototype.send.mockResolvedValue({});

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toBe('Data processed successfully and file renamed');
    expect(DynamoDBClient.prototype.send).toHaveBeenCalled();
  
    // Check the structure of the calls to DynamoDB
    const dynamoDbCalls = DynamoDBClient.prototype.send.mock.calls;
    dynamoDbCalls.forEach(call => {
      const putItemCommand = call[0];
      expect(putItemCommand).toBeInstanceOf(PutItemCommand);
      if (putItemCommand.input && putItemCommand.input.Item) {
        expect(putItemCommand.input.Item.RaceNotes).toBeUndefined();
      }
    });
  });

  // Error: Test with missing data
  test('handles missing data', async () => {
    const mockEvent = {
      Records: [{ s3: { bucket: { name: 'test-bucket' }, object: { key: 'test-file.json' } } }],
    };

    const mockS3Data = {
      trackName: 'Test Track',
      notes: 'Test Notes'
    };

    S3Client.prototype.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({ Body: { transformToString: () => Promise.resolve(JSON.stringify(mockS3Data)) } });
      }
      return Promise.resolve({});
    });

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toBe('Error processing data: Cannot read properties of undefined (reading \'races\')');
  });

  // Error: Test with invalid JSON
  test('handles invalid JSON', async () => {
    const mockEvent = {
      Records: [{ s3: { bucket: { name: 'test-bucket' }, object: { key: 'test-file.json' } } }],
    };

    S3Client.prototype.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({ Body: { transformToString: () => Promise.resolve('Invalid JSON') } });
      }
      return Promise.resolve({});
    });

    const result = await lambdaHandler(mockEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toBe('Error processing data: Unexpected token \'I\', "Invalid JSON" is not valid JSON');
  });

  // Performance: Test with large data set
  test('handles large data set', async () => {
    const mockEvent = {
      Records: [{ s3: { bucket: { name: 'test-bucket' }, object: { key: 'large_test.json' } } }],
    };

    const largeData = { ...testData };
    largeData.races = Array(1000).fill(testData.races[0]);

    const mockS3Data = {
      trackName: 'Large Test Track',
      notes: 'Large Test Notes',
      data: largeData
    };

    S3Client.prototype.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({ Body: { transformToString: () => Promise.resolve(JSON.stringify(mockS3Data)) } });
      }
      return Promise.resolve({});
    });

    DynamoDBClient.prototype.send.mockResolvedValue({});

    const startTime = Date.now();
    const result = await lambdaHandler(mockEvent);
    const endTime = Date.now();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toBe('Data processed successfully and file renamed');
    expect(endTime - startTime).toBeLessThan(5000); // Assuming it should process in less than 5 seconds
  });
});