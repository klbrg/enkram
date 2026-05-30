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
    const env = {
        ran: true,
        node: process.version,
        hasEndpoint: !!process.env.COSMOS_ENDPOINT,
        hasKey: !!process.env.COSMOS_KEY,
        keyLen: (process.env.COSMOS_KEY || '').length,
        endpointTail: (process.env.COSMOS_ENDPOINT || '').slice(-32)
    };

    // Temporary probe: confirm the handler runs and surface env presence (no Cosmos).
    if ((req.query && req.query.probe) || (req.body && req.body.message === '__probe__')) {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { probe: env } };
        return;
    }

    try {
        const message = req.body?.message?.trim() || "";
        const trackId = req.body?.trackId || null;
        const cleanedMessage = sanitizeMessage(message);
        if (cleanedMessage.length > 500) {
            context.res = { status: 400, body: "För långt meddelande." };
            return;
        }

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
        // Temporary: return 200 so the SWA platform doesn't strip the diagnostic body.
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                diag: {
                    name: err && err.name,
                    code: err && err.code,
                    statusCode: err && err.statusCode,
                    message: ((err && err.message) || '').slice(0, 500),
                    env
                }
            }
        };
    }
};
