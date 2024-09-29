const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const region = process.env.AWS_REGION || "ap-southeast-2";
const dynamodbClient = new DynamoDBClient({ region });

exports.lambdaHandler = async (event, context) => {
	//console.log('Received event:', JSON.stringify(event, null, 2));

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
			const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
			const s3Client = new S3Client({ region });

			const body = JSON.parse(event.body);
			//console.log('Received body:', JSON.stringify(body, null, 2));

			const fileName = body.fileName;
			const fileContent = Buffer.from(body.fileContent, 'base64');

			// Parse the file content to get the new structure
			const uploadedData = JSON.parse(fileContent.toString());
			//console.log('Parsed uploaded data:', JSON.stringify(uploadedData, null, 2));

			// The uploaded data is already in the structure we want
			const raceData = uploadedData;

			//console.log('Processed race data:', JSON.stringify(raceData, null, 2));

			// Create a new filename with timestamp
			const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp
			const newFileName = `${timestamp}-${fileName}`;

			const putParams = {
				Bucket: process.env.S3_BUCKET_NAME,
				Key: newFileName,
				Body: JSON.stringify(raceData),
				ContentType: 'application/json'
			};
			//console.log('S3 put params:', JSON.stringify(putParams, null, 2));

			const putCommand = new PutObjectCommand(putParams);
			await s3Client.send(putCommand);
			await s3Client.send(putCommand);

			//console.log('File uploaded successfully to S3');

			return {
				statusCode: 200,
				headers: {
					"Access-Control-Allow-Origin": `http://${process.env.WEBSITE_ENDPOINT}`,
					"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
					"Access-Control-Allow-Methods": "OPTIONS,POST"
				},
				body: JSON.stringify({ message: 'File uploaded successfully', fileName: newFileName })
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
		//console.error('Error in lambda handler:', error);
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": `http://${process.env.WEBSITE_ENDPOINT}`,
				"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
				"Access-Control-Allow-Methods": "OPTIONS,POST"
			},
			body: JSON.stringify({ error: 'Internal server error', details: error.message, stack: error.stack })
		};
	}
};