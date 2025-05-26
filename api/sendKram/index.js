const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");
const sanitizeHtml = require('sanitize-html');

function sanitizeMessage(input) {
    const noHtml = sanitizeHtml(input || '', {
        allowedTags: [],       // inga taggar tillåtna
        allowedAttributes: {}  // inga attribut tillåtna
    });

    // Ersätt \n med <br>
    return noHtml.replace(/\n/g, '<br>');
}

const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
});

const container = client.database("kramDB").container("kramar");


module.exports = async function (context, req) {
    const message = req.body?.message?.trim() || "";
    const trackId = req.body?.trackId || null;
    const cleanedMessage = sanitizeMessage(message);
    if (cleanedMessage.length > 500) {
        context.res = { status: 400, body: "För långt meddelande." };
        return;
    }

    const id = crypto.randomBytes(4).toString("hex");
    const createdAt = new Date().toISOString();
    const ttl = 86400; // 24 timmar

    await container.items.create({ id, message: cleanedMessage, trackId, createdAt, ttl });

    context.res = {
        status: 200,
        body: { link: `https://enkram.se/${id}` },
    };
};

