//   .env file should contain:
// SCRIPT_MODE: "TEST" || "SEND"; test prints data blobs
//   to the console, while send actually delivers them to
//   the MQTT broker
// SIF_USER: your SIF cloud website account username
// SIF_PASSWD: your SIF cloud website account password
// BROKER: address of the SIF cloud MQTT broker
// USERPOOLID: formatted as region_poolId, the pool id
//   of the SIF cloud user pool
// CLIENTID: the client ID of the SIF cloud user pool
(require("dotenv")).config();
const config = process.env;
if(
    !(config.SCRIPT_MODE === "TEST" || config.SCRIPT_MODE === "SEND") ||
    !config.SIF_USER    ||
    !config.SIF_PASSWD  ||
    !config.BROKER      ||
    !config.USERPOOLID  ||
    !config.CLIENTID
) throw("Missing required .env properties!");

const { DateTime } = require("luxon");
const mqtt = require("mqtt");

//   Creates a generalized abstraction of what a virtual
// sensor that produces data on some regular interval
// might look like. Provide an interval (in ms) and a
// function to run when the interval triggers.
class VirtualSensor {
    constructor(interval, producer) {
        this.interval = interval;
        this.producer = producer;
        this.active = false;
        this.intervalRef = null;
    }

    start() {
        console.info("Virtual sensor starting up!");
        this.producer();
        this.intervalRef = setInterval(this.producer, this.interval);
        this.active = true;
    }

    stop() {
        console.info("Virtual sensor stopped!");
        this.active = false;
        clearInterval(this.intervalRef);
    }
}

//   Generates sample data for the app "VirtualSensorA".
//   This virtual sensor has two metrics: temperature and
// distance. Sample temperature values are in [60, 80),
// and sample distances are in [0, 30).
function generateSampleData() {
    return {
        app_name: "VirtualSensorB",
        time: DateTime.utc().toISO(),
        metadata: {
            deploymentType: "virtual"
        },
        payload_fields: {
            temperature: {
                displayName: "vtp",
                unit: "F",
                value: parseInt(100 * (Math.random() * 20 + 60)) / 100
            },
            distance: {
                displayName: "sus",
                unit: "cm",
                value: parseInt(30 * Math.random())
            }
        }
    }
}

// https://www.npmjs.com/package/amazon-cognito-identity-js/v/3.0.11-beta.5
// Use case 4
async function CognitoLogin() {
    var resolve;
    const tokenPromise = new Promise((res, _) => {
        resolve = res;
    });

    const AmazonCognitoIdentity = require("amazon-cognito-identity-js");
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: config.SIF_USER,
        Password: config.SIF_PASSWD
    });

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: config.SIF_USER,
        Pool: new AmazonCognitoIdentity.CognitoUserPool({
            UserPoolId: config.USERPOOLID,
            ClientId: config.CLIENTID
        })
    });

    cognitoUser.authenticateUser(
        authDetails,
        {
            onSuccess: function(result) {
                const accessToken = result.getAccessToken().getJwtToken();
                resolve({
                    success: true,
                    token: accessToken
                });
            },
            onFailure: function(error) {
                resolve({
                    success: false,
                    token: null,
                    error: error
                });
            }
        }
    );

    return await tokenPromise;
}


//   Connects to the MQTT client and instantiates
// a virtual sensor. Once the connection has been
// established, the virtual sensor activated.
function main() {
    const client = mqtt.connect(config.BROKER);
    var accessToken;
    let blobNum = 0;

    const sensor = new VirtualSensor(5000, () => {
        const data = generateSampleData();
        const blob = {
            app_name: data.app_name,
            token: accessToken,
            data: data
        }
        if(config.SCRIPT_MODE === "SEND") {
            const outgoing = JSON.stringify(blob);
            console.log(`[BLOB ${blobNum++}] Sending ${outgoing.length} bytes to the broker`);
            client.publish("data/ingest", outgoing);
        } else {
            console.debug(`[BLOB ${blobNum++}] ` + JSON.stringify(blob));
        }
    });

    client.on("error", err => {
        console.error(err);
    });

    client.on("connect", async () => {
        console.info("Connected to MQTT broker.")
        const { success, token, error } = await CognitoLogin();
        if(!success) {
            console.error(error);
            console.error("Failed to acquire Cognito token!");
            client.end();
        } else {
            console.info("Issued Cognito token.");
            accessToken = token;
            sensor.start();
        }
    });
}

main();
