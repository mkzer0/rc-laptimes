const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const region = process.env.AWS_REGION || "ap-southeast-2";
const dynamodbClient = new DynamoDBClient({ region });

exports.lambdaHandler = async (event, context) => {
	console.log('Received event:', JSON.stringify(event, null, 2));

	try {
		const httpMethod = event.httpMethod;

		if (httpMethod === 'GET') {
			// Handle GET request (retrieve data from DynamoDB)
			const params = {
				TableName: process.env.DYNAMODB_TABLE_NAME,
			};

			const command = new ScanCommand(params);
			const scanResponse = await dynamodbClient.send(command);

			const items = scanResponse.Items.map(item => unmarshall(item));

			const response = {
				statusCode: 200,
				headers: {
					"Access-Control-Allow-Origin": `http://${process.env.WEBSITE_ENDPOINT}`,
					"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
					"Access-Control-Allow-Methods": "GET,OPTIONS,POST"
				},
				body: JSON.stringify(items)
			};

			return response;

		} else if (httpMethod === 'POST') {
			// Handle POST request (file upload)
			// This part remains unchanged as it's still uploading to S3
			const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
			const s3Client = new S3Client({ region });

			const body = JSON.parse(event.body);
			const fileName = body.fileName;
			const fileContent = Buffer.from(body.fileContent, 'base64');

			const putParams = {
				Bucket: process.env.S3_BUCKET_NAME,
				Key: fileName,
				Body: fileContent,
				ContentType: 'application/json'
			};
			const putCommand = new PutObjectCommand(putParams);
			await s3Client.send(putCommand);

			return {
				statusCode: 200,
				headers: {
					"Access-Control-Allow-Origin": `http://${process.env.WEBSITE_ENDPOINT}`,
					"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
					"Access-Control-Allow-Methods": "OPTIONS,POST"
				},
				body: JSON.stringify({ message: 'File uploaded successfully' })
			};

		} else {
			// Handle unsupported HTTP methods
			return {
				statusCode: 405,
				headers: {
					"Access-Control-Allow-Origin": `http://${process.env.WEBSITE_ENDPOINT}`,
					"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
					"Access-Control-Allow-Methods": "OPTIONS,POST"
				},
				body: JSON.stringify({ error: 'Method not allowed' })
			};
		}
	} catch (error) {
		console.error('Error:', error);
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": `http://${process.env.WEBSITE_ENDPOINT}`,
				"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
				"Access-Control-Allow-Methods": "OPTIONS,POST"
			},
			body: JSON.stringify({ error: 'Internal server error' })
		};
	}
};