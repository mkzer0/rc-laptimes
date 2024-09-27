const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { marshall } = require("@aws-sdk/util-dynamodb");

const region = process.env.AWS_REGION;
const dynamodbClient = new DynamoDBClient({ region });
const s3Client = new S3Client({ region });

exports.lambdaHandler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        // Extract race location and notes from filename
        const fileNameWithoutExtension = key.split('/').pop().split('.')[0];
        const [raceLocation, ...notesParts] = fileNameWithoutExtension.split('-');
        const raceNotes = notesParts.join('-');

        // Get the object from S3
        const getObjectParams = { Bucket: bucket, Key: key };
        const { Body } = await s3Client.send(new GetObjectCommand(getObjectParams));
        const fileContent = await Body.transformToString();
        const jsonData = JSON.parse(fileContent);

        for (const document of jsonData) {
            for (const race of document.races) {
                const raceId = race.uuid;
                const raceName = race.name;
                const raceStartTime = new Date(race.date).getTime();

                for (const driver of race.drivers) {
                    const driverName = driver.name;

                    for (let i = 0; i < driver.laps.length; i++) {
                        const lap = driver.laps[i];
                        if (lap.kind === 'normal') {
                            const lapTimestamp = raceStartTime + lap.endTimestamp;
                            const item = {
                                'RaceId': raceId,
                                'LapTimestamp': lapTimestamp,
                                'RaceName': raceName,
                                'RaceLocation': raceLocation,
                                'RaceNotes': raceNotes,
                                'DriverName': driverName,
                                'LapNumber': i,
                                'LapTime': lap.duration,
                                'LapDateTime': new Date(lapTimestamp).toISOString()
                            };

                            const params = {
                                TableName: process.env.DYNAMODB_TABLE_NAME,
                                Item: marshall(item)
                            };

                            await dynamodbClient.send(new PutItemCommand(params));
                        }
                    }
                }
            }
        }

        console.log('Data processed and stored successfully');
        return { statusCode: 200, body: JSON.stringify('Data processed successfully') };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: JSON.stringify('Error processing data') };
    }
};
