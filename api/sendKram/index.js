const { CosmosClient } = require("@azure/cosmos");
const sanitizeHtml = require('sanitize-html');

function sanitizeMessage(input) {
    const noHtml = sanitizeHtml(input || '', {
        allowedTags: [],       // inga taggar tillåtna
        allowedAttributes: {}  // inga attribut tillåtna
    });

    // Ersätt \n med <br>
    return noHtml.replace(/\n/g, '<br>');
}

function generateShortId(length = 4) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

module.exports = async function (context, req) {
    try {
        const message = req.body?.message?.trim() || "";
        const trackId = req.body?.trackId || null;
        const cleanedMessage = sanitizeMessage(message);
        if (cleanedMessage.length > 500) {
            context.res = { status: 400, body: "För långt meddelande." };
            return;
        }

        // Skapa klienten per anrop så att en saknad miljövariabel inte kraschar hela function-appen.
        const client = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY,
        });
        const container = client.database("kramDB").container("kramar");

        const id = generateShortId(4);
        const createdAt = new Date().toISOString();
        const ttl = 86400; // 24 timmar

        await container.items.create({ id, message: cleanedMessage, trackId, createdAt, ttl });

        context.res = {
            status: 200,
            body: { link: `https://enkram.se/${id}` },
        };
    } catch (err) {
        context.log("sendKram error:", err && err.name, err && err.code, err && err.message);
        context.res = { status: 500, body: "Kunde inte skapa kramen." };
    }
};
