const https = require('https');
const { app } = require('@azure/functions');

app.timer('keepWarm', {
    schedule: '0 */3 * * * *', // Every 3 minutes
    handler: async (myTimer, context) => {
        const dummyId = Math.random().toString(36).substring(2, 10);
        const url = `https://enkram.se/api/getKram/${dummyId}`;

        https.get(url, (res) => {
            context.log(`\u{1F501} keepWarm ping: ${url} → ${res.statusCode}`);
        }).on("error", (err) => {
            context.log("\u274C keepWarm error:", err.message);
        });
    }
});