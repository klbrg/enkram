const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");
const sanitizeHtml = require('sanitize-html');

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function sanitizeMessage(input) {
    // Inga taggar eller attribut tillåtna — ren text in, ren text ut.
    return sanitizeHtml(input || '', {
        allowedTags: [],
        allowedAttributes: {}
    });
}

function generateShortId(length) {
    let id = '';
    for (let i = 0; i < length; i++) {
        id += ID_CHARS[crypto.randomInt(ID_CHARS.length)];
    }
    return id;
}

module.exports = async function (context, req) {
    try {
        const message = (req.body?.message || '').toString().trim();

        // Spotify-track-id:n är base62 (~22 tecken). Allt annat avvisas så att
        // id:t tryggt kan stoppas in i en iframe-src på klienten.
        const rawTrackId = req.body?.trackId;
        const trackId = (typeof rawTrackId === 'string' && /^[a-zA-Z0-9]{8,40}$/.test(rawTrackId))
            ? rawTrackId
            : null;

        const cleanedMessage = sanitizeMessage(message);

        // Längden kontrolleras före \n→<br>-konverteringen, annars "kostar"
        // varje radbrytning 4 tecken och giltiga meddelanden avvisas.
        if (cleanedMessage.length > 500) {
            context.res = { status: 400, body: "För långt meddelande." };
            return;
        }
        if (!cleanedMessage && !trackId) {
            context.res = { status: 400, body: "Tomt meddelande." };
            return;
        }

        const storedMessage = cleanedMessage.replace(/\n/g, '<br>');

        // Skapa klienten per anrop så att en saknad miljövariabel inte kraschar hela function-appen.
        const client = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY,
        });
        const container = client.database("kramDB").container("kramar");

        const createdAt = new Date().toISOString();
        const ttl = 86400; // 24 timmar

        // 4 tecken ger ~14,7M kombinationer — krockar är osannolika men möjliga,
        // så försök igen vid 409 och väx till 5 tecken efter några försök.
        let id;
        for (let attempt = 0; ; attempt++) {
            id = generateShortId(attempt < 3 ? 4 : 5);
            try {
                await container.items.create({ id, message: storedMessage, trackId, createdAt, ttl });
                break;
            } catch (err) {
                if (err?.code !== 409 || attempt >= 5) throw err;
            }
        }

        context.res = {
            status: 200,
            body: { id, link: `https://enkram.se/${id}` },
        };
    } catch (err) {
        context.log("sendKram error:", err && err.name, err && err.code, err && err.message);
        context.res = { status: 500, body: "Kunde inte skapa kramen." };
    }
};
