const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const region = process.env.AWS_REGION || "ap-southeast-2";
const dynamodbClient = new DynamoDBClient({ region });
const s3Client = new S3Client({ region });

exports.lambdaHandler = async (event, context) => {
    try {
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        // Get the object from S3
        const getObjectParams = { Bucket: bucket, Key: key };
        const { Body } = await s3Client.send(new GetObjectCommand(getObjectParams));
        const fileContent = await Body.transformToString();
        const raceData = JSON.parse(fileContent);

        // Check if trackName is present
        if (!raceData.trackName) {
            throw new Error('TrackName is missing');
        }

        const trackName = raceData.trackName;
        const notes = raceData.notes || '';
        const races = raceData.data.races;

        for (const race of races) {
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
                            'RaceId': { S: raceId },
                            'LapTimestamp': { N: lapTimestamp.toString() },
                            'RaceName': { S: raceName },
                            'TrackName': { S: trackName },
                            'RaceNotes': { S: notes },
                            'DriverName': { S: driverName },
                            'LapNumber': { N: i.toString() },
                            'LapTime': { N: lap.duration.toString() },
                            'LapDateTime': { S: new Date(lapTimestamp).toISOString() }
                        };

                        const params = {
                            TableName: process.env.DYNAMODB_TABLE_NAME,
                            Item: item
                        };

                        await dynamodbClient.send(new PutItemCommand(params));
                        //console.log('Inserted item:', JSON.stringify(item, null, 2));
                    }
                }
            }
        }

        // Rename the file by adding 'completed' suffix
        const newKey = `${key.split('.').slice(0, -1).join('.')}-completed.json`;
        
        await s3Client.send(new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${key}`,
            Key: newKey
        }));

        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: key
        }));

        //console.log('Data processed and stored successfully. File renamed to:', newKey);
        return { statusCode: 200, body: JSON.stringify('Data processed successfully and file renamed') };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: JSON.stringify('Error processing data: ' + error.message) };
    }
};
