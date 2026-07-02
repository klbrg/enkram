const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const id = context.bindingData.id;

    try {
        // Skapa klienten per anrop så att en saknad miljövariabel inte kraschar hela function-appen.
        const client = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY,
        });
        const container = client.database("kramDB").container("kramar");

        const { resource: kram } = await container.item(id, id).read();

        if (!kram) {
            context.res = { status: 404 };
            return;
        }

        // _ts är Cosmos senast-ändrad (epoch-sekunder); ttl räknas därifrån.
        const expiresAt = (kram._ts && kram.ttl) ? (kram._ts + kram.ttl) * 1000 : null;

        context.res = {
            status: 200,
            body: {
                message: kram.message,
                trackId: kram.trackId || null,
                expiresAt
            }
        };
    } catch (err) {
        if (err && err.code === 404) {
            context.res = { status: 404 };
            return;
        }
        context.log("getKram error:", err && err.name, err && err.code, err && err.message);
        context.res = { status: 500 };
    }
};
